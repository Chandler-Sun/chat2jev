import { ProxyLab } from "@/components/proxy-lab";
import { listRoutes } from "@/lib/proxy/store";

export const dynamic = "force-dynamic";

export default async function ProxyPage() {
  return <ProxyLab initialRoutes={await listRoutes()} />;
}
