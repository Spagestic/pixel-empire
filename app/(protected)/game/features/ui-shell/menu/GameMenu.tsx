"use client";

import { X, Menu } from "lucide-react";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { usePlayer } from "@game/features/player/hooks/use-player";
import { useWorld } from "@game/features/world/hooks/use-world";
import { useJobs } from "@game/features/jobs/hooks/use-jobs";
import { MAX_HUNGER } from "@game/shared/contracts/game-config";

import { useMenuState } from "@game/features/ui-shell/menu/use-menu-state";
import { MenuSidebar } from "@game/features/ui-shell/menu/MenuSidebar";
import { MenuHeader } from "@game/features/ui-shell/menu/MenuHeader";
import { MenuContent } from "@game/features/ui-shell/menu/MenuContent";

export function GameMenu() {
  const { playerInfo, leaderboard, alivePlayers } = usePlayer();
  const { ownedCount, totalIncomePerCycle, properties } = useWorld();
  const { activeJob } = useJobs();

  const { open, setOpen, activeNav, setActiveNav } = useMenuState();

  if (!playerInfo) return null;

  const jobsBadge = !!activeJob;
  const hunger = playerInfo.hunger ?? MAX_HUNGER;
  const isLowHunger = hunger <= 25;

  useEffect(() => {
    const locked = open && (activeNav === "profile" || activeNav === "chat");
    window.dispatchEvent(
      new CustomEvent("game:set-movement-locked", {
        detail: { locked },
      }),
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("game:set-movement-locked", {
          detail: { locked: false },
        }),
      );
    };
  }, [open, activeNav]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={true}
          className="overflow-hidden p-0 md:max-h-[80vh] md:max-w-5xl lg:max-w-275"
        >
          <DialogTitle className="sr-only">Game Menu</DialogTitle>
          <DialogDescription className="sr-only">
            Manage your inventory, jobs, properties, rankings, and more.
          </DialogDescription>

          <SidebarProvider className="items-start">
            <MenuSidebar
              activeNav={activeNav}
              setActiveNav={setActiveNav}
              playerInfo={playerInfo}
              ownedCount={ownedCount}
              totalIncomePerCycle={totalIncomePerCycle}
              jobsBadge={jobsBadge}
              hunger={hunger}
            />

            <main className="flex h-[min(80vh,78vh)] flex-1 flex-col overflow-hidden">
              <MenuHeader activeNav={activeNav} setActiveNav={setActiveNav} />
              <MenuContent
                activeNav={activeNav}
                playerInfo={playerInfo}
                leaderboard={leaderboard}
                alivePlayers={alivePlayers.map((p) => ({
                  _id: String(p._id),
                  x: p.x,
                  y: p.y,
                  name: p.name,
                }))}
                activeJob={activeJob}
                properties={properties}
              />
            </main>
          </SidebarProvider>
        </DialogContent>
      </Dialog>

      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "pointer-events-auto relative size-12 rounded-full shadow-lg",
          "flex items-center justify-center",
          "transition-all duration-200 hover:scale-110 active:scale-95",
          "ring-2 ring-white/10",
          open
            ? " ring-primary/30 bg-primary text-primary-foreground"
            : "bg-muted text-foreground  hover:ring-primary/40",
        )}
        aria-label={open ? "Close menu" : "Open menu"}
      >
        <div
          className={cn(
            "transition-transform duration-300",
            open && "rotate-180",
          )}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </div>
        {!open && jobsBadge && (
          <span className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-orange-500 border-2 border-background animate-pulse" />
        )}
        {!open && isLowHunger && !jobsBadge && (
          <span className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-red-500 border-2 border-background animate-pulse" />
        )}
      </button>
    </>
  );
}
