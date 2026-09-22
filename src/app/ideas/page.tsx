import Link from "next/link";
import { ArrowLeftIcon, LightbulbIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getTool } from "@/tools/registry";

export default function IdeasPage() {
  const tool = getTool("ideas");
  return (
    <Empty className="mx-auto max-w-[720px] border border-dashed py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LightbulbIcon />
        </EmptyMedia>
        <EmptyTitle>{tool?.label ?? "Idea 广场"}</EmptyTitle>
        <EmptyDescription>{tool?.description} Chat2Jev 对比已经可以单独使用。</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link href="/" className={buttonVariants()}>
          <ArrowLeftIcon data-icon="inline-start" />
          回到 Chat2Jev
        </Link>
      </EmptyContent>
    </Empty>
  );
}
