"use client";

import { Settings2 } from "lucide-react";
import { useEffect, useState, type ComponentProps } from "react";
import { toast } from "sonner";

import { renameLink } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { LinkSettingsPanel } from "./link-settings-panel";

type Props = ComponentProps<typeof LinkSettingsPanel> & { name: string };

function LinkName({ linkId, name }: { linkId: string; name: string }) {
  const [saved, setSaved] = useState(name);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="link-name">Nom du lien</Label>
      <Input
        id="link-name"
        defaultValue={name}
        onBlur={async (e) => {
          const next = e.target.value.trim();
          if (next === saved) return;
          const result = await renameLink(linkId, next);
          if (result.error) toast.error(result.error);
          else setSaved(next);
        }}
      />
    </div>
  );
}

export function LinkSettingsDialog({ name, ...panel }: Props) {
  const [open, setOpen] = useState(false);

  // Expiration lives in this dialog: an email or the header chip links to #expiration
  useEffect(() => {
    const sync = () => {
      if (window.location.hash === "#expiration") setOpen(true);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" className="bg-card" />}>
        <Settings2 />
        Réglages du lien
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-heading">Réglages du lien</DialogTitle>
          <DialogDescription>Chaque changement est enregistré tout de suite.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <LinkName linkId={panel.linkId} name={name} />
          <LinkSettingsPanel {...panel} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
