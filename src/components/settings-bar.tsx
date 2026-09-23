"use client";

import { useState } from "react";
import { ChevronDownIcon, EyeIcon, EyeOffIcon, Settings2Icon } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
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
  const { t } = useI18n();
  const [reveal, setReveal] = useState(false);
  const patch = (partial: Partial<Settings>) => onChange({ ...settings, ...partial });
  const llmReady = settings.llmModel.trim().length > 0;
  const hasLlmKey = settings.llmApiKey.trim().length > 0;
  const jevReady = settings.typesafeApiKey.trim().length > 0;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card size="sm" className="shrink-0 py-2" aria-label={t("settings.aria")}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 py-0">
          <div className="flex min-w-0 flex-wrap gap-2">
            <Badge variant="outline" data-tone={llmReady ? "ink" : undefined}>
              {t("settings.convert")}: {settings.llmModel || t("settings.noModel")}
              {hasLlmKey ? ` · ${t("settings.hasKey")}` : ` · ${t("settings.localKey")}`}
            </Badge>
            <Badge variant="outline" data-tone={jevReady ? "moss" : undefined}>
              Jev: {settings.typesafeModel || "jev-latest"}
              {jevReady ? ` · ${t("settings.hasJevKey")}` : ` · ${t("settings.noJevKey")}`}
            </Badge>
          </div>
          <CollapsibleTrigger render={<Button variant="outline" size="sm" />} aria-expanded={open}>
            <Settings2Icon data-icon="inline-start" />
            {open ? t("settings.close") : t("settings.open")}
            <ChevronDownIcon data-icon="inline-end" className={open ? "rotate-180" : undefined} />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-4 pb-4">
            <FieldGroup>
              <div className="grid gap-3 md:grid-cols-5">
                <Field>
                  <FieldLabel htmlFor="llm-base-url">{t("settings.llmUrl")}</FieldLabel>
                  <Input
                    id="llm-base-url"
                    value={settings.llmBaseUrl}
                    onChange={(event) => patch({ llmBaseUrl: event.target.value })}
                    placeholder="https://api.openai.com/v1"
                    spellCheck={false}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="llm-model">{t("settings.llmModel")}</FieldLabel>
                  <Input
                    id="llm-model"
                    value={settings.llmModel}
                    onChange={(event) => patch({ llmModel: event.target.value })}
                    placeholder="gpt-4.1-mini"
                    spellCheck={false}
                  />
                  <FieldDescription>{t("settings.llmModelHint")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="llm-key">{t("settings.llmKey")}</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="llm-key"
                      type={reveal ? "text" : "password"}
                      value={settings.llmApiKey}
                      onChange={(event) => patch({ llmApiKey: event.target.value })}
                      placeholder={t("settings.llmKeyPlaceholder")}
                      autoComplete="off"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        aria-label={reveal ? t("settings.hideKey") : t("settings.showKey")}
                        onClick={() => setReveal((value) => !value)}
                      >
                        {reveal ? <EyeOffIcon /> : <EyeIcon />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="typesafe-key">{t("settings.jevKey")}</FieldLabel>
                  <Input
                    id="typesafe-key"
                    type={reveal ? "text" : "password"}
                    value={settings.typesafeApiKey}
                    onChange={(event) => patch({ typesafeApiKey: event.target.value })}
                    placeholder={t("settings.jevKeyPlaceholder")}
                    autoComplete="off"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="jev-model">{t("settings.jevModel")}</FieldLabel>
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
                <FieldLabel htmlFor="remember-keys">{t("settings.remember")}</FieldLabel>
              </Field>
            </FieldGroup>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
