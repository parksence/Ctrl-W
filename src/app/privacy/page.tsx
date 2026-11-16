import type { Metadata } from "next";
import { REPO_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "데이터 미수집 안내",
  description: "휘발은 입력한 글을 서버로 보내지 않습니다. 무엇이 어디에 남고 언제 사라지는지, 직접 확인하는 방법까지 정리했습니다.",
  alternates: { canonical: "/privacy/" },
};

export default function Privacy() {
  return (
    <main className="doc">
      <a className="back" href="/">
        <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true">
          <rect x="5" y="3" width="5.5" height="10" fill="currentColor" />
          <rect x="5" y="15" width="5.5" height="14" fill="currentColor" />
          <rect x="13.25" y="3" width="5.5" height="15" fill="#ffd60a" />
          <rect x="13.25" y="20" width="5.5" height="6.5" fill="#ff7a1a" />
          <rect x="21.5" y="3" width="5.5" height="6.5" fill="currentColor" />
          <rect x="21.5" y="11.5" width="5.5" height="12" fill="currentColor" />
        </svg>
        휘발
      </a>

      <h1>쓴 글은 어디에도 가지 않습니다</h1>
      <p className="lead">
        휘발에는 서버도, 데이터베이스도, 회원가입도 없습니다. 입력한 글은 지금 보고 있는 이 브라우저 탭 안에서만
        존재하다가, 날려버리는 순간 지워집니다. 운영자도 볼 방법이 없습니다.
      </p>

      <h2>무엇이 어디에 남나요</h2>
      <table>
        <thead>
          <tr>
            <th>항목</th>
            <th>어디에</th>
            <th>언제 사라지나</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>입력한 글</td>
            <td>이 탭의 메모리</td>
            <td>날려버리기, 증발, 새로고침, 탭 닫기 중 먼저 일어나는 때</td>
          </tr>
          <tr>
            <td>‘탭 닫으면 증발’ 모드의 글</td>
            <td>이 탭의 세션 저장소</td>
            <td>날려버리거나 탭을 닫을 때. 새로고침에는 남고, 닫은 탭을 다시 열면 지웁니다</td>
          </tr>
          <tr>
            <td>오늘 날린 횟수와 글자 수</td>
            <td>이 브라우저의 로컬 저장소</td>
            <td>날짜가 바뀌면 0부터. 숫자뿐이고 글 내용은 들어가지 않습니다</td>
          </tr>
          <tr>
            <td>누적 횟수, 최고 콤보, 최고 점수</td>
            <td>이 브라우저의 로컬 저장소</td>
            <td>브라우저에서 사이트 데이터를 지울 때. 역시 숫자뿐입니다</td>
          </tr>
          <tr>
            <td>모드, 효과, 소리 설정</td>
            <td>이 브라우저의 로컬 저장소</td>
            <td>브라우저에서 사이트 데이터를 지울 때</td>
          </tr>
        </tbody>
      </table>
      <p>
        쿠키, 방문 분석 도구, 광고 스크립트, 외부 글꼴은 쓰지 않습니다. 격한 표현에 반응하는 ‘크리티컬’ 연출도 방금 친
        글자 몇 개를 이 브라우저 안에서 비교할 뿐, 결과를 어디에도 남기지 않습니다.
      </p>

      <h2>말로만이 아니라는 걸 확인하는 법</h2>
      <ul>
        <li>
          <strong>네트워크 탭.</strong> 개발자 도구(F12)의 네트워크 탭을 연 채로 글을 쓰고 날려보세요. 처음 페이지를
          불러온 뒤로는 요청이 하나도 생기지 않습니다.
        </li>
        <li>
          <strong>브라우저 차단 규칙.</strong> 이 사이트는 응답 헤더에 <code>connect-src &apos;none&apos;</code>을
          걸어 둡니다. 설령 코드가 글을 밖으로 보내려 해도 브라우저가 막습니다. 네트워크 탭에서 문서 응답의{" "}
          <code>Content-Security-Policy</code> 헤더로 볼 수 있습니다.
        </li>
        <li>
          <strong>공개된 코드.</strong> 전체 코드는 <a href={REPO_URL}>GitHub 저장소</a>에 있습니다.
        </li>
      </ul>

      <h2>이 사이트가 막아줄 수 없는 것</h2>
      <ul>
        <li>
          <strong>회사 PC의 보안 프로그램.</strong> 키 입력이나 화면을 기록하는 프로그램이 깔려 있다면, 그건 브라우저
          바깥에서 일어나는 일이라 어떤 웹사이트도 막지 못합니다. 걱정되면 개인 기기에서 쓰세요.
        </li>
        <li>
          <strong>브라우저 확장 프로그램.</strong> 페이지 내용을 읽는 권한이 있는 확장 프로그램은 입력창도 볼 수
          있습니다. 시크릿 창에서는 대부분 꺼져 있습니다.
        </li>
        <li>
          <strong>접속 기록.</strong> 호스팅을 맡은 Cloudflare에는 어느 웹사이트나 그렇듯 접속 시각과 IP 주소 같은
          기록이 남을 수 있습니다. 거기에 글 내용은 없습니다. 글은 애초에 전송되지 않습니다.
        </li>
        <li>
          <strong>어깨 너머의 시선.</strong> 그럴 땐 Esc를 두 번 누르세요. 업무용 표 화면으로 바뀌고, 다시 두 번
          누르면 돌아옵니다. 휴대폰에서는 표 화면의 파일 이름을 빠르게 세 번 누르면 돌아옵니다.
        </li>
      </ul>

      <h2>문의</h2>
      <p>
        이상한 점이나 고칠 곳을 발견했다면 <a href={`${REPO_URL}/issues`}>GitHub 이슈</a>로 알려주세요.
      </p>
    </main>
  );
}
