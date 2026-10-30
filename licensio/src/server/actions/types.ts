// État renvoyé par les Server Actions de formulaire (useActionState).
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
  // Valeurs saisies, renvoyées pour pré-remplir le formulaire après une erreur.
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};
