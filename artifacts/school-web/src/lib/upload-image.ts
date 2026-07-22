const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export class UploadConfigError extends Error {}

/**
 * Uploads an image file directly from the browser to Cloudinary and
 * returns the resulting public URL. Uses an unsigned upload preset, so
 * no secret key is ever exposed to the browser.
 */
async function uploadImage(file: File, folder: string): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new UploadConfigError(
      "Image uploads aren't configured yet. Ask your developer to set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.",
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || "Image upload failed. Try again.");
  }

  const data = await res.json();
  return data.secure_url as string;
}

export function uploadProfilePicture(file: File): Promise<string> {
  return uploadImage(file, "educore/avatars");
}

export function uploadSchoolLogo(file: File): Promise<string> {
  return uploadImage(file, "educore/school-logos");
}

export function uploadCertificateTemplate(file: File): Promise<string> {
  return uploadImage(file, "educore/certificate-templates");
}

export function uploadHomeworkSubmission(file: File): Promise<string> {
  return uploadImage(file, "educore/homework-submissions");
}
