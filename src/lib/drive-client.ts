/**
 * 브라우저 → 구글 드라이브 직접 업로드.
 * 서버(Vercel 함수)를 거치지 않으므로 60초 실행 제한이 없고 전송도 한 번만 일어난다.
 */

const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

export class DriveAuthExpired extends Error {}

/** multipart/related 업로드. 토큰이 만료되면 DriveAuthExpired를 던진다. */
export async function uploadToDriveFromBrowser(input: {
  accessToken: string;
  folderId: string;
  fileName: string;
  blob: Blob;
}): Promise<string> {
  const boundary = `grapenote-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: input.fileName, parents: [input.folderId] });
  const head =
    `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\ncontent-type: ${input.blob.type || "video/mp4"}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;

  const res = await fetch(`${UPLOAD_API}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "content-type": `multipart/related; boundary=${boundary}`,
    },
    body: new Blob([head, input.blob, tail]),
  });
  if (res.status === 401 || res.status === 403) throw new DriveAuthExpired();
  if (!res.ok) throw new Error(`드라이브 업로드 실패 (${res.status})`);
  const json = await res.json();
  if (!json.id) throw new Error("드라이브 업로드 결과가 비어 있어요");
  return json.id as string;
}
