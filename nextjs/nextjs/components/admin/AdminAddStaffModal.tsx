"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, UserPlus, X } from "lucide-react";
import { saveManagerAction, saveResellerAction, saveDealerAction } from "@/actions/forms";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { cn } from "@/lib/cn";

export type AdminAddStaffOption = { value: string; label: string };

type StaffKind = "manager" | "reseller" | "dealer";

function PasswordFieldWithToggle({
  id,
  name,
  required = false,
  onInput,
}: {
  id: string;
  name: string;
  required?: boolean;
  onInput?: React.FormEventHandler<HTMLInputElement>;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        onInput={onInput}
        className="pr-10"
        required={required}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}

export function AdminAddStaffModal({
  managerOptions,
  resellerOptions,
  triggerClassName,
  iconOnlyTrigger = false,
}: {
  managerOptions: AdminAddStaffOption[];
  resellerOptions: AdminAddStaffOption[];
  triggerClassName?: string;
  iconOnlyTrigger?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [kind, setKind] = useState<StaffKind>("manager");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [managerSearch, setManagerSearch] = useState("");
  const [managerSelectedUsername, setManagerSelectedUsername] = useState("");
  const [managerPickerOpen, setManagerPickerOpen] = useState(false);
  const [resellerSearch, setResellerSearch] = useState("");
  const [resellerSelectedUsername, setResellerSelectedUsername] = useState("");
  const [resellerPickerOpen, setResellerPickerOpen] = useState(false);
  const [dealerTicketsManager, setDealerTicketsManager] = useState<"No" | "Yes">("No");

  const open = useCallback(() => {
    const d = dialogRef.current;
    if (!d) return;
    d.showModal();
    setDialogOpen(true);
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onDialogClose = () => setDialogOpen(false);
    d.addEventListener("close", onDialogClose);
    return () => d.removeEventListener("close", onDialogClose);
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [dialogOpen]);

  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) close();
  };

  const filteredManagerOptions = useMemo(() => {
    const q = managerSearch.trim().toLowerCase();
    if (!q) return managerOptions;
    return managerOptions
      .filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
      .slice(0, 8);
  }, [managerOptions, managerSearch]);

  const filteredResellerOptions = useMemo(() => {
    const q = resellerSearch.trim().toLowerCase();
    if (!q) return resellerOptions;
    return resellerOptions
      .filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
      .slice(0, 8);
  }, [resellerOptions, resellerSearch]);

  const handleManagerSearchChange = useCallback(
    (nextRaw: string) => {
      setManagerSearch(nextRaw);
      const next = nextRaw.trim().toLowerCase();
      if (!next) {
        setManagerSelectedUsername("");
        return;
      }
      const match = managerOptions.find((o) => o.label.toLowerCase() === next || o.value.toLowerCase() === next);
      setManagerSelectedUsername(match?.value ?? "");
    },
    [managerOptions],
  );

  const handleResellerSearchChange = useCallback(
    (nextRaw: string) => {
      setResellerSearch(nextRaw);
      const next = nextRaw.trim().toLowerCase();
      if (!next) {
        setResellerSelectedUsername("");
        return;
      }
      const match = resellerOptions.find((o) => o.label.toLowerCase() === next || o.value.toLowerCase() === next);
      setResellerSelectedUsername(match?.value ?? "");
    },
    [resellerOptions],
  );

  const selectManagerOption = useCallback((value: string, label: string) => {
    setManagerSelectedUsername(value);
    setManagerSearch(label);
    setManagerPickerOpen(false);
  }, []);

  const selectResellerOption = useCallback((value: string, label: string) => {
    setResellerSelectedUsername(value);
    setResellerSearch(label);
    setResellerPickerOpen(false);
  }, []);

  const validateCreateStaffPasswords = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const passwordInput = form.elements.namedItem("password") as HTMLInputElement | null;
    const confirmInput = form.elements.namedItem("password_confirm") as HTMLInputElement | null;
    if (!passwordInput || !confirmInput) return;
    confirmInput.setCustomValidity("");
    if (passwordInput.value !== confirmInput.value) {
      confirmInput.setCustomValidity("Passwords do not match.");
      confirmInput.reportValidity();
      e.preventDefault();
    }
  }, []);

  return (
    <>
      <Button
        type="button"
        onClick={open}
        className={cn(
          iconOnlyTrigger
            ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background p-0 text-foreground shadow-sm transition-colors hover:bg-muted/40"
            : "inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:w-auto",
          triggerClassName,
        )}
        aria-label="Add staff"
        title="Add staff"
      >
        <UserPlus className="h-4 w-4" aria-hidden />
        {iconOnlyTrigger ? <span className="sr-only">Add staff</span> : "Add staff"}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className={cn(
          "fixed left-1/2 top-1/2 z-[120] max-h-[calc(100vh-2rem)] w-[calc(100vw-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/80 bg-card p-0 text-foreground shadow-xl ring-1 ring-black/[0.06]",
          "[&::backdrop]:bg-black/55 [&::backdrop]:backdrop-blur-[2px]",
        )}
        onMouseDown={onBackdropMouseDown}
      >
        <div className="flex max-h-[inherit] min-h-0 flex-col">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
                Add staff
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose the account type, then fill in the details.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 shrink-0 rounded-lg p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              aria-label="Close"
              onClick={close}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="staff-add-kind">Staff type</Label>
              <div
                id="staff-add-kind"
                role="radiogroup"
                aria-label="Staff type"
                className="grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-background/60 p-1"
              >
                {([
                  { value: "manager", label: "Manager" },
                  { value: "reseller", label: "Reseller" },
                  { value: "dealer", label: "Dealer" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={kind === opt.value}
                    onClick={() => setKind(opt.value)}
                    className={cn(
                      "inline-flex h-9 items-center justify-center rounded-lg border text-sm font-semibold transition-colors",
                      kind === opt.value
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/40 hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-1 text-sm text-muted-foreground">
              {kind === "manager" ? (
                <p>Managers sign in to the billing portal and oversee resellers, dealers, and users in their branch.</p>
              ) : kind === "reseller" ? (
                <p>Resellers sit under a manager, add dealers, and can own user accounts.</p>
              ) : (
                <p>Dealers belong to a reseller and manage day-to-day user accounts.</p>
              )}
            </div>

            <div className="mt-5 border-t border-border/50 pt-5">
              {kind === "manager" ? (
                <form key="mgr" action={saveManagerAction} onSubmit={validateCreateStaffPasswords} className="space-y-4">
                  <input type="hidden" name="_intent" value="new" />
                  <input type="hidden" name="return_to_staff" value="1" />

                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-mgr-name">Display name</Label>
                    <Input id="staff-modal-mgr-name" name="name" autoComplete="name" placeholder="e.g. North region lead" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-mgr-user">Username</Label>
                    <p className="text-xs text-muted-foreground">Billing login; stored in lowercase.</p>
                    <Input
                      id="staff-modal-mgr-user"
                      name="username"
                      autoComplete="username"
                      placeholder="e.g. jsmith"
                      className="font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-mgr-pass">Password</Label>
                    <PasswordFieldWithToggle id="staff-modal-mgr-pass" name="password" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-mgr-pass-confirm">Confirm password</Label>
                    <PasswordFieldWithToggle
                      id="staff-modal-mgr-pass-confirm"
                      name="password_confirm"
                      onInput={(e) => e.currentTarget.setCustomValidity("")}
                      required
                    />
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-border/50 pt-4 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={close}>
                      Cancel
                    </Button>
                    <Button type="submit" className="w-full gap-2 sm:w-auto">
                      <UserPlus className="h-4 w-4" aria-hidden />
                      Create manager
                    </Button>
                  </div>
                </form>
              ) : kind === "reseller" ? (
                <form key="res" action={saveResellerAction} onSubmit={validateCreateStaffPasswords} className="space-y-4">
                  <input type="hidden" name="_intent" value="new" />
                  <input type="hidden" name="return_to_staff" value="1" />

                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-res-name">Display name</Label>
                    <Input id="staff-modal-res-name" name="name" autoComplete="organization" placeholder="e.g. City cable partner" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-res-user">Username</Label>
                    <Input
                      id="staff-modal-res-user"
                      name="username"
                      autoComplete="username"
                      placeholder="e.g. partner01"
                      className="font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-res-pass">Password</Label>
                    <PasswordFieldWithToggle id="staff-modal-res-pass" name="password" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-res-pass-confirm">Confirm password</Label>
                    <PasswordFieldWithToggle
                      id="staff-modal-res-pass-confirm"
                      name="password_confirm"
                      onInput={(e) => e.currentTarget.setCustomValidity("")}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-res-mgr">Manager</Label>
                    <div className="relative">
                      <Input
                        id="staff-modal-res-mgr"
                        type="text"
                        value={managerSearch}
                        onChange={(e) => handleManagerSearchChange(e.target.value)}
                        onFocus={() => setManagerPickerOpen(true)}
                        onBlur={() => setTimeout(() => setManagerPickerOpen(false), 120)}
                        placeholder="Search and select manager..."
                        autoComplete="off"
                        className="h-10"
                      />
                      {managerPickerOpen ? (
                        <div className="absolute bottom-full z-20 mb-2 max-h-64 w-full overflow-y-auto rounded-lg border border-border/80 bg-slate-950/95 p-2 shadow-xl">
                          {filteredManagerOptions.length ? (
                            <div className="flex flex-col gap-1 py-0.5">
                              {filteredManagerOptions.map((o) => (
                                <button
                                  key={o.value}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectManagerOption(o.value, o.label)}
                                  className={cn(
                                    "flex w-full items-center rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
                                    managerSelectedUsername === o.value
                                      ? "border-primary/35 bg-primary/15 text-primary"
                                      : "border-slate-700/80 bg-slate-900 text-slate-100 hover:border-slate-500 hover:bg-slate-800",
                                  )}
                                >
                                  {o.label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="px-2 py-1.5 text-sm text-muted-foreground">No matching managers</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <input type="hidden" name="manager" value={managerSelectedUsername} />
                    <p className="text-xs text-muted-foreground">
                      {managerSelectedUsername ? `Selected: ${managerSelectedUsername}` : "Pick a manager from the suggestions."}
                    </p>
                    {managerOptions.length === 0 ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400">Create a manager first before adding resellers.</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-border/50 pt-4 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={close}>
                      Cancel
                    </Button>
                    <Button type="submit" className="w-full gap-2 sm:w-auto" disabled={managerOptions.length === 0}>
                      <UserPlus className="h-4 w-4" aria-hidden />
                      Create reseller
                    </Button>
                  </div>
                </form>
              ) : (
                <form key="dlr" action={saveDealerAction} onSubmit={validateCreateStaffPasswords} className="space-y-4">
                  <input type="hidden" name="_intent" value="new" />
                  <input type="hidden" name="return_to_staff" value="1" />

                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-dlr-name">Display name</Label>
                    <Input id="staff-modal-dlr-name" name="name" autoComplete="organization" placeholder="e.g. Main street office" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-dlr-user">Username</Label>
                    <Input
                      id="staff-modal-dlr-user"
                      name="username"
                      autoComplete="username"
                      placeholder="e.g. shop_main"
                      className="font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-dlr-pass">Password</Label>
                    <PasswordFieldWithToggle id="staff-modal-dlr-pass" name="password" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-dlr-pass-confirm">Confirm password</Label>
                    <PasswordFieldWithToggle
                      id="staff-modal-dlr-pass-confirm"
                      name="password_confirm"
                      onInput={(e) => e.currentTarget.setCustomValidity("")}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-dlr-res">Parent reseller</Label>
                    <div className="relative">
                      <Input
                        id="staff-modal-dlr-res"
                        type="text"
                        value={resellerSearch}
                        onChange={(e) => handleResellerSearchChange(e.target.value)}
                        onFocus={() => setResellerPickerOpen(true)}
                        onBlur={() => setTimeout(() => setResellerPickerOpen(false), 120)}
                        placeholder="Search and select reseller..."
                        autoComplete="off"
                        className="h-10"
                      />
                      {resellerPickerOpen ? (
                        <div className="absolute bottom-full z-20 mb-2 max-h-64 w-full overflow-y-auto rounded-lg border border-border/80 bg-slate-950/95 p-2 shadow-xl">
                          {filteredResellerOptions.length ? (
                            <div className="flex flex-col gap-1 py-0.5">
                              {filteredResellerOptions.map((o) => (
                                <button
                                  key={o.value}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectResellerOption(o.value, o.label)}
                                  className={cn(
                                    "flex w-full items-center rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
                                    resellerSelectedUsername === o.value
                                      ? "border-primary/35 bg-primary/15 text-primary"
                                      : "border-slate-700/80 bg-slate-900 text-slate-100 hover:border-slate-500 hover:bg-slate-800",
                                  )}
                                >
                                  {o.label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="px-2 py-1.5 text-sm text-muted-foreground">No matching resellers</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <input type="hidden" name="username_owner" value={resellerSelectedUsername} />
                    <p className="text-xs text-muted-foreground">
                      {resellerSelectedUsername ? `Selected: ${resellerSelectedUsername}` : "Pick a reseller from the suggestions."}
                    </p>
                    {resellerOptions.length === 0 ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400">Create a reseller first before adding dealers.</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-modal-dlr-tickets">Tickets in portal</Label>
                    <p className="text-xs text-muted-foreground">Allow this dealer to work the ticket queue.</p>
                    <input type="hidden" name="tickets_manager" value={dealerTicketsManager} />
                    <div
                      id="staff-modal-dlr-tickets"
                      role="radiogroup"
                      aria-label="Tickets in portal"
                      className="grid w-full max-w-[220px] grid-cols-2 gap-1 rounded-lg border border-border/60 bg-background/60 p-1"
                    >
                      {(["No", "Yes"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={dealerTicketsManager === value}
                          onClick={() => setDealerTicketsManager(value)}
                          className={cn(
                            "inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                            dealerTicketsManager === value
                              ? "border-primary/50 bg-primary/15 text-primary"
                              : "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/40 hover:text-foreground",
                          )}
                        >
                          {value === "Yes" ? "On" : "Off"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-border/50 pt-4 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={close}>
                      Cancel
                    </Button>
                    <Button type="submit" className="w-full gap-2 sm:w-auto" disabled={resellerOptions.length === 0}>
                      <UserPlus className="h-4 w-4" aria-hidden />
                      Create dealer
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
