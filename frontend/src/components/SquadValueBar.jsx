import { formatValue } from "../utils/format";
import ScoreboardValue from "./ScoreboardValue.jsx";

/**
 * Alt sabit skorbord barı. Tek odak: toplam kadro değeri. Formasyon ve oyuncu
 * sayısı bilgisi sağ rail'de olduğu için burada tekrar edilmez.
 */
export default function SquadValueBar({ totalValue }) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-mid/60 bg-night/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-4 px-4 py-3 sm:justify-end sm:gap-5">
        <span className="eyebrow">Toplam Kadro Değeri</span>
        <ScoreboardValue
          text={formatValue(totalValue)}
          className="text-3xl font-semibold text-neon sm:text-4xl"
        />
      </div>
    </footer>
  );
}
