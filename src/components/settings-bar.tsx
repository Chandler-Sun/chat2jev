"use client";

import { useState } from "react";
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
  const jevReady = settings.typesafeApiKey.trim().length > 0;

  return (
    <section className="settings" aria-label="连接">
      <div className="connection">
        <div className="chips">
          <span className="chip" data-missing={!llmReady}>
            拆分 · {settings.llmModel || "未选模型"}
            {settings.llmApiKey.trim() ? "" : " · 无 Key"}
          </span>
          <span className="chip" data-missing={!jevReady}>
            Jev · {settings.typesafeModel || "jev-latest"}
            {jevReady ? "" : " · 未填 Key"}
          </span>
        </div>
        <button type="button" className="btn" onClick={() => onOpenChange(!open)} aria-expanded={open}>
          {open ? "收起连接" : "连接设置"}
        </button>
      </div>
      {open ? (
        <>
          <div className="settings-grid">
            <label className="field">
              <span>常规模型地址</span>
              <input
                value={settings.llmBaseUrl}
                onChange={(event) => patch({ llmBaseUrl: event.target.value })}
                placeholder="https://api.openai.com/v1"
                spellCheck={false}
              />
            </label>
            <label className="field">
              <span>模型</span>
              <input
                value={settings.llmModel}
                onChange={(event) => patch({ llmModel: event.target.value })}
                placeholder="gpt-4.1-mini"
                spellCheck={false}
              />
            </label>
            <label className="field">
              <span>常规模型 Key</span>
              <input
                type={reveal ? "text" : "password"}
                value={settings.llmApiKey}
                onChange={(event) => patch({ llmApiKey: event.target.value })}
                placeholder="本地模型可以留空"
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>TypeSafe Key</span>
              <input
                type={reveal ? "text" : "password"}
                value={settings.typesafeApiKey}
                onChange={(event) => patch({ typesafeApiKey: event.target.value })}
                placeholder="sk-..."
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>Jev</span>
              <input
                value={settings.typesafeModel}
                onChange={(event) => patch({ typesafeModel: event.target.value })}
                placeholder="jev-latest"
                spellCheck={false}
              />
            </label>
          </div>
          <div className="settings-foot">
            <label className="check">
              <input
                type="checkbox"
                checked={settings.rememberKeys}
                onChange={(event) => patch({ rememberKeys: event.target.checked })}
              />
              在这台浏览器记住密钥
            </label>
            <button type="button" className="btn btn-ghost" onClick={() => setReveal((value) => !value)}>
              {reveal ? "隐藏密钥" : "显示密钥"}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
