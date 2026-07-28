/**
 * AI가 생성한 제안서 텍스트를 인쇄용 HTML 창으로 열어
 * 브라우저의 "인쇄 → PDF로 저장" 기능으로 PDF를 만들 수 있게 한다.
 * jsPDF 등으로 클라이언트에서 직접 PDF를 생성하면 한글 폰트를 별도로
 * 임베딩해야 하는 문제가 있어, 시스템 폰트를 그대로 쓰는 이 방식이 더 안정적이다.
 */
export function openProposalPrintView(schoolName: string, content: string) {
  const win = window.open("", "_blank", "width=800,height=1000");
  if (!win) {
    alert("팝업이 차단되었습니다. 브라우저의 팝업 차단을 해제한 뒤 다시 시도하세요.");
    return;
  }

  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  win.document.write(`
    <!DOCTYPE html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <title>${schoolName} 제안서</title>
        <style>
          body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; padding: 48px; line-height: 1.7; color: #101828; }
          h1 { font-size: 20px; border-bottom: 3px solid #3B63E0; padding-bottom: 12px; margin-bottom: 24px; }
          .meta { color: #667085; font-size: 12px; margin-bottom: 24px; }
          .content { font-size: 14px; white-space: pre-wrap; }
          @media print { body { padding: 24px; } }
        </style>
      </head>
      <body>
        <h1>SchoolPass 도입 제안서 — ${schoolName}</h1>
        <p class="meta">작성일: ${new Date().toLocaleDateString("ko-KR")}</p>
        <div class="content">${escaped}</div>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `);
  win.document.close();
}
