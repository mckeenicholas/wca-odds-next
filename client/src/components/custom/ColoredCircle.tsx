interface ColoredCircleProps {
  color: string;
  class?: string;
}

export function ColoredCircle(props: ColoredCircleProps) {
  return (
    <svg width="10" height="10" viewBox="0 0 30 30" class={props.class}>
      <path
        d="M 15 15 m -14, 0 a 14,14 0 1,1 28,0 a 14,14 0 1,1 -28,0"
        stroke={props.color}
        fill={props.color}
        stroke-width="1"
      />
    </svg>
  );
}
