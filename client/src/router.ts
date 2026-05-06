import { createRouter, createWebHistory } from "vue-router";

const HomePage = () => import("./views/HomePage.vue");
const CompetitionPage = () => import("./views/CompetitionPage.vue");
const SimulationPage = () => import("./views/SimulationPage.vue");
const CustomPage = () => import("./views/CustomPage.vue");
const RankingsPage = () => import("./views/RankingsPage.vue");
const PersonalRankingsPage = () => import("./views/PersonalRankingsPage.vue");

const routes = [
  { component: HomePage, name: "home", path: "/" },
  { component: CompetitionPage, name: "competition", path: "/competition/:id" },
  {
    component: SimulationPage,
    name: "competition-results",
    path: "/competition/:id/results/",
  },
  { component: CustomPage, name: "custom", path: "/custom/" },
  {
    component: SimulationPage,
    name: "custom-results",
    path: "/custom/results/",
  },
  { component: RankingsPage, name: "rankings", path: "/rankings" },
  {
    component: PersonalRankingsPage,
    name: "personal-rankings",
    path: "/rankings/personal/:id?",
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
