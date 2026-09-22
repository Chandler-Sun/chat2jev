import { getTool } from "@/tools/registry";
import Link from "next/link";

export default function IdeasPage() {
  const tool = getTool("ideas");
  return (
    <section className="planned">
      <p>即将推出</p>
      <h1>{tool?.label}</h1>
      <p>{tool?.description} 请求转换已经可以单独使用。</p>
      <Link href="/" className="btn btn-primary" style={{ display: "inline-flex", marginTop: 8 }}>
        回到请求转换
      </Link>
    </section>
  );
}
