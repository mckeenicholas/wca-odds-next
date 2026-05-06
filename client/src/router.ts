import { createRouter, createWebHistory } from "vue-router";

const HomePage = () => import("./views/HomePage.vue");
const CompetitionPage = () => import("./views/CompetitionPage.vue");
const SimulationPage = () => import("./views/SimulationPage.vue");
const CustomPage = () => import("./views/CustomPage.vue");
const RankingsPage = () => import("./views/RankingsPage.vue");
const PersonalRankingsPage = () => import("./views/PersonalRankingsPage.vue");

const routes = [
  { path: "/", name: "home", component: HomePage },
  { path: "/competition/:id", name: "competition", component: CompetitionPage },
  {
    path: "/competition/:id/results/",
    name: "competition-results",
    component: SimulationPage,
  },
  { path: "/custom/", name: "custom", component: CustomPage },
  {
    path: "/custom/results/",
    name: "custom-results",
    component: SimulationPage,
  },
  { path: "/rankings", name: "rankings", component: RankingsPage },
  {
    path: "/rankings/personal/:id?",
    name: "personal-rankings",
    component: PersonalRankingsPage,
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
