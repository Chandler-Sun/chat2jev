import { ProxyLab } from "@/components/proxy-lab";
import { listRoutes } from "@/lib/proxy/store";

export default async function ProxyPage() {
  return <ProxyLab initialRoutes={await listRoutes()} />;
}
