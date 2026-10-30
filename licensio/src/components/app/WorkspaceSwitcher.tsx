"use client";

import Link from "next/link";
import { useRef } from "react";
import { switchWorkspace } from "@/server/actions/workspaces";

type Props = {
  activeId: string;
  workspaces: { id: string; name: string }[];
};

export function WorkspaceSwitcher({ activeId, workspaces }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <div className="space-y-1.5">
      <label htmlFor="workspaceId" className="sr-only px-1 text-xs font-medium uppercase tracking-wide text-neutral-400 md:not-sr-only">
        Espace de travail
      </label>
      <form ref={formRef} action={switchWorkspace}>
        <select
          id="workspaceId"
          name="workspaceId"
          defaultValue={activeId}
          onChange={() => formRef.current?.requestSubmit()}
          className="block w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm font-medium focus:border-neutral-900 focus:outline-none"
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <noscript>
          <button type="submit" className="mt-1 text-xs underline">
            Changer
          </button>
        </noscript>
      </form>
      <Link href="/workspaces/new" className="block px-1 text-xs text-neutral-500 hover:text-neutral-900">
        + Nouvel espace
      </Link>
    </div>
  );
}
