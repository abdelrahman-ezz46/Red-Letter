// The entry point named by index.html. It exists only so the page has one
// stable script URL to point at — all real startup logic lives in
// shared/bootstrap.js, where it can be tested without a <script> tag.
import { boot } from "./shared/bootstrap.js";

boot();
