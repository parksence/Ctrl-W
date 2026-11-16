// 격한 표현 감지. 방금 친 글자 끝부분만 이 브라우저 안에서 확인하며,
// 결과는 화면 연출(크리티컬)에만 쓰이고 어디에도 기록되지 않습니다.

const HOT =
  /(씨발|시발|씨바|씨팔|시팔|ㅅㅂ|ㅆㅂ|좆|좇|존나|졸라|ㅈㄴ|개새|새끼|병신|ㅂㅅ|미친|미쳤|지랄|ㅈㄹ|꺼져|닥쳐|빡[치쳐침]|짜증|열받|퇴사|때려치|죽겠|망할|젠장|염병|엿같|엿먹|개같|거지같|fuck|shit|damn|wtf|[!?]{3,}|ㅡㅡ+|;;;+)$/i;

/** 커서 바로 앞이 격한 표현으로 끝나면 그 표현이 시작한 위치를, 아니면 -1을 돌려줍니다. */
export function hotAt(text: string, caret: number): number {
  const from = Math.max(0, caret - 12);
  const m = HOT.exec(text.slice(from, caret));
  return m ? from + m.index : -1;
}
