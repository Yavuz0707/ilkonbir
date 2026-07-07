import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Header from "./components/Header.jsx";
import HomePage from "./pages/HomePage.jsx";
import ClubsPage from "./pages/ClubsPage.jsx";
import ComingSoonPage from "./pages/ComingSoonPage.jsx";
import GamesPage from "./pages/GamesPage.jsx";
import HigherLowerGamePage from "./pages/HigherLowerGamePage.jsx";
import LogoQuizGamePage from "./pages/LogoQuizGamePage.jsx";
import TransferRouteGamePage from "./pages/TransferRouteGamePage.jsx";
import LineupBuilderPage from "./pages/LineupBuilderPage.jsx";

export default function App() {
  const location = useLocation();

  return (
    <>
      <Header />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<HomePage />} />
          <Route path="/kulupler" element={<ClubsPage />} />
          <Route path="/club/:clubId" element={<LineupBuilderPage />} />
          <Route path="/oyunlar" element={<GamesPage />} />
          <Route path="/oyunlar/kim-daha-iyi" element={<HigherLowerGamePage />} />
          <Route path="/oyunlar/logo-bulmaca" element={<LogoQuizGamePage />} />
          <Route path="/oyunlar/transfer-rotasi" element={<TransferRouteGamePage />} />
          <Route path="/dunya-kupasi" element={<ComingSoonPage title="Dünya Kupası" />} />
          <Route path="/istatistikler" element={<ComingSoonPage title="İstatistikler" />} />
          <Route path="/oyuncular" element={<ComingSoonPage title="Oyuncular" />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}
