import { motion } from "framer-motion";
import ClubCard from "./ClubCard.jsx";

/** Staggered kulüp kartı grid'i. `values` opsiyonel: club.id -> toplam değer. */
export default function ClubGrid({ clubs, values }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {clubs.map((club) => (
        <ClubCard key={club.id} club={club} value={values ? values[club.id] : undefined} />
      ))}
    </motion.div>
  );
}
