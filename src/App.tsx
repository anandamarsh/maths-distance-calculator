import { I18nProvider } from "./i18n";
import ArcadeLevelOneScreen from "./screens/ArcadeLevelOneScreen";
import RotatePrompt from "./components/RotatePrompt";
import { installEmbeddedStorageBridge } from "./utils/embeddedStorageBridge";
import { useEffect } from "react";

export default function App() {
  useEffect(() => installEmbeddedStorageBridge(), []);

  return (
    <I18nProvider>
      <RotatePrompt />
      <ArcadeLevelOneScreen />
    </I18nProvider>
  );
}
