import "server-only";

/**
 * 구글 드라이브 연동 (아카이브 백업용).
 * scope는 drive.file — 이 앱이 만든 파일/폴더에만 접근 가능 (기존 드라이브 내용은 못 본다).
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

function clientCreds() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isDriveConfigured(): boolean {
  return clientCreds() !== null;
}

export function buildAuthUrl(redirectUri: string, state: string): string | null {
  const creds = clientCreds();
  if (!creds) return null;
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent", // refresh_token을 확실히 받기 위해
    state,
  });
  return `${AUTH_URL}?${params}`;
}

/** 인증 코드 → refresh token 교환 */
export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{ refreshToken: string } | null> {
  const creds = clientCreds();
  if (!creds) return null;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.refresh_token) return null;
  return { refreshToken: json.refresh_token };
}

export async function getAccessToken(refreshToken: string): Promise<string | null> {
  const creds = clientCreds();
  if (!creds) return null;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  return (await res.json()).access_token ?? null;
}

/** "GrapeNote 아카이브" 폴더 생성 (연결 시 1회) */
export async function createArchiveFolder(accessToken: string): Promise<string | null> {
  const res = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "GrapeNote 아카이브",
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!res.ok) return null;
  return (await res.json()).id ?? null;
}

/** 영상 파일 업로드 (multipart/related). 성공 시 드라이브 파일 id. */
export async function uploadToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  blob: Blob
): Promise<string | null> {
  const boundary = `grapenote-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const head =
    `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\ncontent-type: ${blob.type || "video/mp4"}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;

  const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": `multipart/related; boundary=${boundary}`,
    },
    body: new Blob([head, blob, tail]),
  });
  if (!res.ok) return null;
  return (await res.json()).id ?? null;
}
