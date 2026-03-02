// トップページ（/）にアクセスしたら /signin にリダイレクト
// redirect() はサーバーコンポーネントで使える Next.js の関数
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/signin");
}
