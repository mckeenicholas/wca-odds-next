import { Button } from "../ui/button";

interface ErrorPanelProps {
  error: string;
}

export function ErrorPanel(props: ErrorPanelProps) {
  return (
    <div class="flex flex-col items-center justify-center">
      <p>Error: {props.error}</p>
      <div class="mt-2">
        <Button
          onClick={() => {
            globalThis.history.back();
          }}
        >
          Back
        </Button>
      </div>
    </div>
  );
}
