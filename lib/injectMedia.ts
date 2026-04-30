import { supabase } from "./supabaseClient";

export const INJECT_MEDIA_BUCKET = "inject-media";
export const INJECT_MEDIA_MAX_FILE_SIZE = 12 * 1024 * 1024;
export const INJECT_MEDIA_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const INJECT_MEDIA_ALLOWED_TYPES = new Set(INJECT_MEDIA_ACCEPT.split(","));

export type InjectMedia = {
  id: string;
  inject_id: string;
  storage_path: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
  created_by?: string | null;
  signed_url?: string | null;
};

export type PendingInjectMedia = {
  id: string;
  file: File;
  alt_text: string;
};

function createClientId() {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("Your browser does not support secure file attachment IDs.");
  }
  return globalThis.crypto.randomUUID();
}

function sanitizeFileName(name: string) {
  const clean = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean.slice(-80) || "image";
}

async function getImageDimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth || null, height: image.naturalHeight || null });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      resolve({ width: null, height: null });
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });
}

function validateImageFile(file: File) {
  if (!INJECT_MEDIA_ALLOWED_TYPES.has(file.type)) {
    throw new Error(`"${file.name}" must be a PNG, JPEG, WebP, or GIF image.`);
  }
  if (file.size > INJECT_MEDIA_MAX_FILE_SIZE) {
    throw new Error(`"${file.name}" exceeds the 12 MB limit.`);
  }
}

function defaultAltText(file: File, fallback?: string | null) {
  const trimmedFallback = fallback?.trim();
  if (trimmedFallback) return trimmedFallback;
  const fromName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return fromName || "";
}

export function createPendingInjectMedia(files: File[], altTextBase?: string | null): PendingInjectMedia[] {
  files.forEach(validateImageFile);

  return files.map((file) => ({
    id: createClientId(),
    file,
    alt_text: defaultAltText(file, altTextBase),
  }));
}

export async function attachSignedUrlsToInjects<T extends { id: string; media?: InjectMedia[] | null }>(
  injects: T[]
): Promise<T[]> {
  const uniquePaths = Array.from(
    new Set(
      injects.flatMap((inject) => (inject.media ?? []).map((media) => media.storage_path).filter(Boolean))
    )
  );

  if (uniquePaths.length === 0) {
    return injects.map((inject) => ({
      ...inject,
      media: (inject.media ?? []).map((media) => ({ ...media, signed_url: null })),
    }));
  }

  const { data, error } = await supabase.storage
    .from(INJECT_MEDIA_BUCKET)
    .createSignedUrls(uniquePaths, 60 * 60);

  if (error) throw error;

  const urlByPath = new Map<string, string | null>();
  for (const row of data ?? []) {
    if (row.path) {
      urlByPath.set(row.path, row.signedUrl ?? null);
    }
  }

  return injects.map((inject) => ({
    ...inject,
    media: (inject.media ?? [])
      .slice()
      .sort((a, b) => {
        const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
      })
      .map((media) => ({
        ...media,
        signed_url: urlByPath.get(media.storage_path) ?? null,
      })),
  }));
}

export async function uploadInjectMediaFiles(params: {
  injectId: string;
  files: Array<File | PendingInjectMedia>;
  altTextBase?: string | null;
}): Promise<InjectMedia[]> {
  const files = params.files.filter(Boolean);
  if (files.length === 0) return [];

  files.forEach((item) => validateImageFile(item instanceof File ? item : item.file));

  const { data: existingRows, error: existingError } = await supabase
    .from("inject_media")
    .select("sort_order")
    .eq("inject_id", params.injectId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (existingError) throw existingError;

  let nextSortOrder = (existingRows?.[0]?.sort_order ?? -1) + 1;
  const createdRows: InjectMedia[] = [];

  try {
    for (const item of files) {
      const file = item instanceof File ? item : item.file;
      const path = `injects/${params.injectId}/${createClientId()}-${sanitizeFileName(file.name)}`;
      const dimensions = await getImageDimensions(file);
      const altText = item instanceof File ? defaultAltText(file, params.altTextBase) : item.alt_text.trim();

      const { error: uploadError } = await supabase.storage
        .from(INJECT_MEDIA_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: row, error: insertError } = await supabase
        .from("inject_media")
        .insert({
          inject_id: params.injectId,
          storage_path: path,
          mime_type: file.type,
          width: dimensions.width,
          height: dimensions.height,
          alt_text: altText || null,
          sort_order: nextSortOrder,
        })
        .select("id, inject_id, storage_path, mime_type, width, height, alt_text, sort_order, created_at, created_by")
        .single();

      if (insertError) {
        await supabase.storage.from(INJECT_MEDIA_BUCKET).remove([path]);
        throw insertError;
      }

      createdRows.push({ ...(row as InjectMedia), signed_url: null });
      nextSortOrder += 1;
    }
  } catch (error) {
    for (const media of createdRows) {
      await deleteInjectMedia(media).catch(() => undefined);
    }
    throw error;
  }

  return attachSignedUrlsToInjects([{ id: params.injectId, media: createdRows }]).then(
    (rows) => rows[0]?.media ?? createdRows
  );
}

export async function deleteInjectMedia(media: Pick<InjectMedia, "id" | "storage_path">) {
  const { error: deleteRowError } = await supabase.from("inject_media").delete().eq("id", media.id);
  if (deleteRowError) throw deleteRowError;
}

export async function updateInjectMediaMetadata(
  mediaId: string,
  patch: { alt_text?: string | null; sort_order?: number }
) {
  const payload: Record<string, string | number | null> = {};
  if ("alt_text" in patch) {
    payload.alt_text = patch.alt_text?.trim() ? patch.alt_text.trim() : null;
  }
  if (typeof patch.sort_order === "number" && Number.isFinite(patch.sort_order)) {
    payload.sort_order = patch.sort_order;
  }
  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase.from("inject_media").update(payload).eq("id", mediaId);
  if (error) throw error;
}

export async function reorderInjectMedia(injectId: string, media: Pick<InjectMedia, "id">[]) {
  const results = await Promise.all(
    media.map((item, index) =>
      supabase
        .from("inject_media")
        .update({ sort_order: index })
        .eq("id", item.id)
        .eq("inject_id", injectId)
    )
  );

  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw firstError;
}
