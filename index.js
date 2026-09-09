require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

const SHEET_ID = process.env.SHEET_ID || '1VJGZ7QJBmbydtQxTOUpBxOv6nk77gAOABrtiEkmD89A';
const SHEET_NAME = process.env.SHEET_NAME || '출결신고기록';

function getServiceAccountCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY 환경변수(Secret)가 설정되지 않았습니다.');
  }
  return JSON.parse(raw);
}

let sheetsClientPromise = null;
async function getSheetsClient() {
  if (!sheetsClientPromise) {
    sheetsClientPromise = (async () => {
      const credentials = getServiceAccountCredentials();
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const client = await auth.getClient();
      return google.sheets({ version: 'v4', auth: client });
    })();
  }
  return sheetsClientPromise;
}

function formatNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

async function appendRow(row) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:J`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

function kakaoReply(text) {
  return {
    version: '2.0',
    template: { outputs: [{ simpleText: { text } }] },
  };
}

app.get('/', (req, res) => {
  res.send('OK - 출결지각관리챗봇 스킬 서버 동작 중');
});

app.post('/kakao/skill', async (req, res) => {
  let replyText = '처리 중 오류가 발생했습니다. 다시 시도해주세요.';

  try {
    const requestBody = req.body || {};
    const utterance = (requestBody.userRequest && requestBody.userRequest.utterance) || '';
    const userId = (requestBody.userRequest && requestBody.userRequest.user && requestBody.userRequest.user.id) || '';
    const parts = utterance.split('/').map((s) => s.trim());

    const now = formatNow();

    const date = parts[0];
    const name = parts[1];
    const phone = parts[2];
    const seatType = parts[3];
    const seatName = parts[4];
    const type = parts[5];
    const isAttendance = type === '출석';
    const hasRequiredParts = isAttendance ? parts.length >= 6 : parts.length >= 7;

    if (hasRequiredParts) {
      const reason = parts.slice(6).join(' / ');

      await appendRow([now, date, name, phone, seatType, seatName, type, reason, userId, utterance]);

      replyText = `${date} ${name} 학생, ${type} 신고가 접수되었습니다.\n\n`
        + `전화번호: ${phone}\n좌석유형: ${seatType}\n좌석명: ${seatName}`
        + (reason ? `\n사유: ${reason}` : '')
        + `\n\n위 내용으로 기록되었습니다 😊`;
    } else {
      await appendRow([now, '', '', '', '', '', '', '', userId, utterance]);
      replyText = '형식이 맞지 않아요 😥\n날짜/이름/전화번호뒷자리/좌석유형/좌석명/결석또는지각또는출석/사유 순서로 \'/\'로 구분해서 다시 입력해주세요.';
    }
  } catch (err) {
    console.error('스킬 처리 오류:', err);
    replyText = '처리 중 오류가 발생했습니다. 다시 시도해주세요.';
  }

  res.json(kakaoReply(replyText));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: 포트 ${PORT}`);
});
