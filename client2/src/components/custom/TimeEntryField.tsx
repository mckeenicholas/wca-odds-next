import { createSignal, createEffect } from "solid-js";
import { toClockFormat, toInt } from "../../lib/utils";
import { Input } from "../ui/input";

interface TimeEntryFieldProps {
  value: number;
  onChange: (val: number) => void;
}

const formatInput = (input: string): string => {
  const number = toInt(input.replaceAll(/\D/gu, ""));
  if (number === null || number === 0) {
    return "";
  }

  const str = number.toString().padStart(8, "0").slice(-8);
  const [hh, mm, ss, cc] = [str.slice(0, 2), str.slice(2, 4), str.slice(4, 6), str.slice(6, 8)];
  return `${hh}:${mm}:${ss}.${cc}`.replaceAll(/^[0:]*(?!\.)/gu, "");
};

const toCentiseconds = (input: string): number => {
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

  const num = toInt(digits);
  if (num === null) {
    return 0;
  }
  const hh = Math.floor(num / 1_000_000) * 360_000;
  const mm = Math.floor((num % 1_000_000) / 10_000) * 6000;
  const ss = Math.floor((num % 10_000) / 100) * 100;
  const cc = num % 100;

  return hh + mm + ss + cc;
};

export function TimeEntryField(props: TimeEntryFieldProps) {
  const [inputValue, setInputValue] = createSignal("");

  const updateInputFromModel = (value: number) => {
    if (value === -1) {
      setInputValue("DNF");
    } else if (value === 0) {
      setInputValue("");
    } else {
      const formatted = toClockFormat(value);
      setInputValue(formatted);
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
      props.onChange(toCentiseconds(formattedInput));
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
