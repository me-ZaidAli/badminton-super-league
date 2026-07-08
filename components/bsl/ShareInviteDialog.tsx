import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Check,
  Download,
  QrCode,
  Share2,
  Image as ImageIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BSL } from "./BSLPalette";

interface ShareInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  shareUrl: string;
  inviteCode?: string | null;
  filenameSlug?: string;
}

function qrSrc(url: string, size = 320) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&data=${encodeURIComponent(url)}`;
}

export function ShareInviteDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  shareUrl,
  inviteCode,
  filenameSlug,
}: ShareInviteDialogProps) {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedQR, setCopiedQR] = useState(false);
  const qrUrl = useMemo(() => qrSrc(shareUrl), [shareUrl]);
  const slug = (filenameSlug || "bsl-invite")
    .replace(/[^a-z0-9-]+/gi, "-")
    .toLowerCase();

  useEffect(() => {
    if (!open) {
      setCopiedLink(false);
      setCopiedCode(false);
      setCopiedQR(false);
    }
  }, [open]);

  const copy = async (text: string, kind: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "link") setCopiedLink(true);
      else setCopiedCode(true);
      setTimeout(() => {
        setCopiedLink(false);
        setCopiedCode(false);
      }, 1500);
      toast({ title: kind === "link" ? "Link copied" : "Code copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const copyQRToClipboard = async () => {
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      // Some browsers need PNG specifically
      const pngBlob =
        blob.type === "image/png"
          ? blob
          : new Blob([blob], { type: "image/png" });
      // @ts-ignore - ClipboardItem present in modern browsers
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ]);
      setCopiedQR(true);
      setTimeout(() => setCopiedQR(false), 1500);
      toast({
        title: "QR code copied",
        description: "Paste it into a chat or doc.",
      });
    } catch (e: any) {
      toast({
        title: "Couldn't copy QR",
        description: "Try downloading instead.",
        variant: "destructive",
      });
    }
  };

  const downloadQR = async () => {
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug}-qr.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const shareNative = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: subtitle || title,
          url: shareUrl,
        });
      } else {
        await copy(shareUrl, "link");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden border-0"
        style={{ background: BSL.card, color: "white" }}
        data-testid="dialog-share-invite"
      >
        <div
          className="px-5 pt-5 pb-3"
          style={{
            background: `linear-gradient(135deg, ${BSL.gold}1a, ${BSL.cyan}1a)`,
            borderBottom: `1px solid ${BSL.border}`,
          }}
        >
          <DialogHeader>
            <DialogTitle
              className="flex items-center gap-2 text-lg uppercase tracking-wide font-black"
              style={{ color: "white" }}
            >
              <Share2 className="h-4 w-4" style={{ color: BSL.gold }} />
              {title}
            </DialogTitle>
            {subtitle && (
              <DialogDescription
                className="text-xs"
                style={{ color: BSL.muted }}
              >
                {subtitle}
              </DialogDescription>
            )}
          </DialogHeader>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* QR */}
          <div className="flex justify-center">
            <div
              className="p-3 rounded-2xl"
              style={{
                background: "white",
                boxShadow: `0 8px 32px ${BSL.cyan}33, 0 0 0 1px ${BSL.gold}55`,
              }}
            >
              <img
                src={qrUrl}
                alt="QR code"
                width={240}
                height={240}
                className="block"
                data-testid="img-share-qr"
              />
            </div>
          </div>

          {/* Invite code */}
          {inviteCode && (
            <button
              onClick={() => copy(inviteCode, "code")}
              className="w-full rounded-xl px-3 py-3 flex items-center justify-between transition-colors"
              style={{
                background: `${BSL.gold}14`,
                border: `1px solid ${BSL.gold}55`,
              }}
              data-testid="button-copy-invite-code"
            >
              <div className="text-left">
                <div
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: BSL.muted }}
                >
                  Invite code
                </div>
                <div
                  className="font-mono text-lg font-black tracking-[0.3em]"
                  style={{ color: BSL.gold }}
                >
                  {inviteCode}
                </div>
              </div>
              {copiedCode ? (
                <Check className="h-4 w-4" style={{ color: BSL.success }} />
              ) : (
                <Copy className="h-4 w-4" style={{ color: BSL.gold }} />
              )}
            </button>
          )}

          {/* Share link */}
          <div
            className="rounded-xl p-3"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
            }}
          >
            <div
              className="text-[10px] uppercase tracking-widest mb-1.5"
              style={{ color: BSL.muted }}
            >
              Shareable link
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 bg-transparent outline-none text-xs font-mono truncate"
                style={{ color: "white" }}
                data-testid="input-share-url"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(shareUrl, "link")}
                className="h-8 px-2 hover:bg-white/10"
                data-testid="button-copy-share-link"
              >
                {copiedLink ? (
                  <Check className="h-3 w-3" style={{ color: BSL.success }} />
                ) : (
                  <Copy className="h-3 w-3" style={{ color: BSL.cyan }} />
                )}
              </Button>
            </div>
          </div>

          {/* Action row */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={copyQRToClipboard}
              className="h-10 text-xs uppercase tracking-wider font-bold border-0"
              style={{ background: `${BSL.cyan}1a`, color: BSL.cyan }}
              data-testid="button-copy-qr"
            >
              {copiedQR ? (
                <Check className="h-3 w-3 mr-1" />
              ) : (
                <ImageIcon className="h-3 w-3 mr-1" />
              )}
              {copiedQR ? "Copied" : "Copy QR"}
            </Button>
            <Button
              variant="outline"
              onClick={downloadQR}
              className="h-10 text-xs uppercase tracking-wider font-bold border-0"
              style={{ background: `${BSL.gold}1a`, color: BSL.gold }}
              data-testid="button-download-qr"
            >
              <Download className="h-3 w-3 mr-1" />
              Save PNG
            </Button>
            <Button
              variant="outline"
              onClick={shareNative}
              className="h-10 text-xs uppercase tracking-wider font-bold border-0"
              style={{ background: "white", color: BSL.bgDeep }}
              data-testid="button-share-native"
            >
              <Share2 className="h-3 w-3 mr-1" />
              Share
            </Button>
          </div>

          <p className="text-[11px] text-center" style={{ color: BSL.muted }}>
            Anyone with the link or QR can sign up and join the BSL
            {inviteCode ? " under this club" : ""}.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
