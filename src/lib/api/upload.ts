import { callAdminFunction } from '../adminApi'

export type ImageBucket = 'question-images' | 'content-icons'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // data URL looks like "data:image/png;base64,AAAA..." — strip the prefix.
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** question-images/content-icons have no authenticated Storage write policy at all (admin doc
 * §10, migration 20260101000005) — every upload goes through this Edge Function's service_role
 * client, same as every other admin write. */
export async function uploadImage(bucket: ImageBucket, file: File): Promise<string> {
  const base64 = await fileToBase64(file)
  const { url } = await callAdminFunction<{ url: string }>('admin-upload-image', {
    bucket,
    fileName: file.name,
    contentType: file.type,
    base64,
  })
  return url
}
