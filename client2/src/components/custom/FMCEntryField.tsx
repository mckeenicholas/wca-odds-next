import { createSignal, createEffect } from "solid-js";
import { toInt } from "../../lib/utils";
import { Input } from "../ui/input";

interface FMCEntryFieldProps {
  value: number;
  onChange: (val: number) => void;
}

const formatInput = (input: string): string => {
  const number = toInt(input.replaceAll(/\D/gu, ""));
  if (number === null || number === 0) {
    return "";
  }
  return number.toString();
};

const toValue = (input: string): number => {
  if (input === "") {
    return 0;
  }
  if (input.toLowerCase() === "dnf") {
    return -1;
  }

  const digits = input.replaceAll(/\D/gu, "");
  if (!digits) {
    return 0;
  }

  return toInt(digits, 0);
};

export function FMCEntryField(props: FMCEntryFieldProps) {
  const [inputValue, setInputValue] = createSignal("");

  const updateInputFromModel = (value: number) => {
    if (value === -1) {
      setInputValue("DNF");
    } else if (value === 0) {
      setInputValue("");
    } else {
      setInputValue(value.toString());
    }
  };

  createEffect(() => {
    updateInputFromModel(props.value);
  });

  const handleInput = (val: string) => {
    if (val === "DNF") {
      setInputValue("DNF");
      props.onChange(-1);
    } else {
      const formattedInput = formatInput(val);
      setInputValue(formattedInput);
      props.onChange(toValue(formattedInput));
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (["d", "D"].includes(event.key)) {
      event.preventDefault();
      setInputValue("DNF");
      props.onChange(-1);
    }
  };

  return (
    <Input
      class="h-9 min-w-[50vw] lg:min-w-0"
      value={inputValue()}
      onInput={handleInput}
      onKeyDown={handleKeydown}
    />
  );
}
