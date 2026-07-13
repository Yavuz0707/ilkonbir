import { formatValue } from "../utils/format";
import ScoreboardValue from "./ScoreboardValue.jsx";

export default function SquadValueBar({ totalValue }) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-night/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-2 sm:justify-end sm:gap-4">
        <span className="eyebrow">Toplam Kadro Değeri</span>
        <ScoreboardValue
          text={formatValue(totalValue)}
          className="text-2xl font-semibold text-neon sm:text-3xl"
        />
      </div>
    </footer>
  );
}
