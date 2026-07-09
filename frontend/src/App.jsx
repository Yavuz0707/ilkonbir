import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Header from "./components/Header.jsx";
import HomePage from "./pages/HomePage.jsx";
import ClubsPage from "./pages/ClubsPage.jsx";
import ClubStatsPage from "./pages/ClubStatsPage.jsx";
import ComingSoonPage from "./pages/ComingSoonPage.jsx";
import ClueGuessGamePage from "./pages/ClueGuessGamePage.jsx";
import GamesPage from "./pages/GamesPage.jsx";
import HigherLowerGamePage from "./pages/HigherLowerGamePage.jsx";
import LogoQuizGamePage from "./pages/LogoQuizGamePage.jsx";
import PlayerDetailPage from "./pages/PlayerDetailPage.jsx";
import PlayersPage from "./pages/PlayersPage.jsx";
import SilhouetteGamePage from "./pages/SilhouetteGamePage.jsx";
import TransferRouteGamePage from "./pages/TransferRouteGamePage.jsx";
import TournamentGamePage from "./pages/TournamentGamePage.jsx";
import WorldCupPage from "./pages/WorldCupPage.jsx";
import LineupBuilderPage from "./pages/LineupBuilderPage.jsx";

export default function App() {
  const location = useLocation();

  return (
    <>
      <Header />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/kulupler" element={<ClubsPage />} />
            <Route path="/kulupler/:clubId" element={<ClubStatsPage />} />
            <Route path="/club/:clubId" element={<LineupBuilderPage />} />
            <Route path="/oyunlar" element={<GamesPage />} />
            <Route path="/oyunlar/kim-daha-iyi" element={<HigherLowerGamePage />} />
            <Route path="/oyunlar/logo-bulmaca" element={<LogoQuizGamePage />} />
            <Route path="/oyunlar/kim-bu-siluet" element={<SilhouetteGamePage />} />
            <Route path="/oyunlar/ipucu-tahmin" element={<ClueGuessGamePage />} />
            <Route path="/oyunlar/transfer-rotasi" element={<TransferRouteGamePage />} />
            <Route path="/oyunlar/turnuva" element={<TournamentGamePage />} />
            <Route path="/dunya-kupasi" element={<WorldCupPage />} />
            <Route path="/istatistikler" element={<ComingSoonPage title="Istatistikler" />} />
            <Route path="/oyuncular" element={<PlayersPage />} />
            <Route path="/oyuncular/:playerId" element={<PlayerDetailPage />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
