import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Moon, Sun } from "lucide-solid";
import { buttonVariants } from "../ui/button";
import { cn } from "../../lib/utils";
import { changeTheme } from "../../lib/colorMode";

export function ColorModeSwitcher() {
  return (
    <div class="flex w-full flex-row justify-end">
      <DropdownMenu placement="bottom-end">
        <DropdownMenu.Trigger
          class={cn(buttonVariants({ variant: "outline" }), "px-2.5 m-2 relative cursor-pointer")}
        >
          <Moon class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Sun class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span class="sr-only">Toggle theme</span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            <DropdownMenu.Item
              onSelect={() => changeTheme("light")}
              class="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            >
              Light
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => changeTheme("dark")}
              class="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            >
              Dark
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => changeTheme("system")}
              class="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            >
              System
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  );
}
