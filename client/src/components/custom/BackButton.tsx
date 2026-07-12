import { useRouter, useLocation } from "@tanstack/solid-router";
import { getParentPath } from "../../lib/utils";
import { Button } from "../ui/button";

export function BackButton() {
  const router = useRouter();
  const location = useLocation();

  const goBack = () => {
    if (globalThis.history.state?.back) {
      globalThis.history.back();
    } else {
      const parent = getParentPath(location().pathname);
      void router.navigate({ to: parent });
    }
  };

  return (
    <Button variant="outline" class="absolute m-2" onClick={goBack}>
      Back
    </Button>
  );
}
