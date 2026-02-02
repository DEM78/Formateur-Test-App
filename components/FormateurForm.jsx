// components/FormateurForm.jsx
import { useFormateurForm } from "./formateur/useFormateurForm";
import FormateurFormView from "./formateur/FormateurFormView";

export default function FormateurForm({ onSubmitForm }) {
  const state = useFormateurForm({ onSubmitForm });
  return <FormateurFormView {...state} />;
}
