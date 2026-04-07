import { I18nProvider } from "./i18n";
import ArcadeLevelOneScreen from "./screens/ArcadeLevelOneScreen";
import RotatePrompt from "./components/RotatePrompt";

export default function App() {
  return (
    <I18nProvider>
      <RotatePrompt />
      <ArcadeLevelOneScreen />
    </I18nProvider>
  );
}
