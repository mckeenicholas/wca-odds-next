import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

interface MultiLabelSwitchProps {
  left: string;
  right: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  class?: string;
}

export function MultiLabelSwitch(props: MultiLabelSwitchProps) {
  const switchId = Math.random().toString(36).slice(2, 9);

  return (
    <div class={`flex items-center ${props.class ?? ""}`}>
      <Label for={switchId} class="cursor-pointer select-none">
        {props.left}
      </Label>
      <Switch checked={props.checked} onChange={props.onChange} id={switchId} class="mx-3" />
      <Label for={switchId} class="cursor-pointer select-none">
        {props.right}
      </Label>
    </div>
  );
}
