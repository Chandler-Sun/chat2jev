"use client";

import { useState } from "react";
import { ChevronDownIcon, EyeIcon, EyeOffIcon, Settings2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import type { Settings } from "@/lib/storage";

export function SettingsBar({
  settings,
  open,
  onOpenChange,
  onChange,
}: {
  settings: Settings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (settings: Settings) => void;
}) {
  const [reveal, setReveal] = useState(false);
  const patch = (partial: Partial<Settings>) => onChange({ ...settings, ...partial });
  const llmReady = settings.llmModel.trim().length > 0;
  const hasLlmKey = settings.llmApiKey.trim().length > 0;
  const jevReady = settings.typesafeApiKey.trim().length > 0;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card size="sm" className="shrink-0 py-2" aria-label="连接与模型设置">
        <CardHeader className="flex flex-row items-center justify-between gap-3 py-0">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" data-tone={llmReady ? "ink" : undefined}>
              转换: {settings.llmModel || "未选模型"}
              {hasLlmKey ? " · 已配 Key" : " · 免 Key / 本地"}
            </Badge>
            <Badge variant="outline" data-tone={jevReady ? "moss" : undefined}>
              Jev: {settings.typesafeModel || "jev-latest"}
              {jevReady ? " · 已填 Key" : " · 未填 Key"}
            </Badge>
          </div>
          <CollapsibleTrigger
            render={<Button variant="outline" size="sm" />}
            aria-expanded={open}
          >
            <Settings2Icon data-icon="inline-start" />
            {open ? "收起设置" : "连接与模型设置"}
            <ChevronDownIcon data-icon="inline-end" className={open ? "rotate-180" : undefined} />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-4 pb-4">
            <FieldGroup>
              <div className="grid gap-3 md:grid-cols-5">
                <Field>
                  <FieldLabel htmlFor="llm-base-url">转换模型 API 地址</FieldLabel>
                  <Input
                    id="llm-base-url"
                    value={settings.llmBaseUrl}
                    onChange={(event) => patch({ llmBaseUrl: event.target.value })}
                    placeholder="https://api.openai.com/v1"
                    spellCheck={false}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="llm-model">转换模型名称</FieldLabel>
                  <Input
                    id="llm-model"
                    value={settings.llmModel}
                    onChange={(event) => patch({ llmModel: event.target.value })}
                    placeholder="gpt-4.1-mini"
                    spellCheck={false}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="llm-key">转换模型 API Key</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="llm-key"
                      type={reveal ? "text" : "password"}
                      value={settings.llmApiKey}
                      onChange={(event) => patch({ llmApiKey: event.target.value })}
                      placeholder="本地模型（如 Ollama）可留空"
                      autoComplete="off"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        aria-label={reveal ? "隐藏密钥" : "显示密钥"}
                        onClick={() => setReveal((value) => !value)}
                      >
                        {reveal ? <EyeOffIcon /> : <EyeIcon />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="typesafe-key">TypeSafe API Key</FieldLabel>
                  <Input
                    id="typesafe-key"
                    type={reveal ? "text" : "password"}
                    value={settings.typesafeApiKey}
                    onChange={(event) => patch({ typesafeApiKey: event.target.value })}
                    placeholder="sk-... (必填)"
                    autoComplete="off"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="jev-model">Jev 模型版本</FieldLabel>
                  <Input
                    id="jev-model"
                    value={settings.typesafeModel}
                    onChange={(event) => patch({ typesafeModel: event.target.value })}
                    placeholder="jev-latest"
                    spellCheck={false}
                  />
                </Field>
              </div>
              <Field orientation="horizontal">
                <Checkbox
                  id="remember-keys"
                  checked={settings.rememberKeys}
                  onCheckedChange={(checked) => patch({ rememberKeys: checked === true })}
                />
                <FieldLabel htmlFor="remember-keys">在这台浏览器记住密钥（调用时会经服务器转发）</FieldLabel>
              </Field>
            </FieldGroup>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
