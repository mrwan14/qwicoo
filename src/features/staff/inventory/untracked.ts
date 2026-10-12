export type TrackedRecipe = {
  is_active: boolean;
  target_type: string;
  menu_item_id: string | null;
  modifier_option_id: string | null;
};

export type MenuTarget = { id: string; name: string };
export type OptionTarget = { id: string; name: string; itemName: string };

export function untrackedMenu(
  items: readonly MenuTarget[],
  options: readonly OptionTarget[],
  recipes: readonly TrackedRecipe[],
): { items: MenuTarget[]; options: OptionTarget[] } {
  const trackedItems = new Set(
    recipes.filter((recipe) => recipe.is_active && recipe.target_type === "MENU_ITEM" && recipe.menu_item_id).map((recipe) => recipe.menu_item_id),
  );
  const trackedOptions = new Set(
    recipes
      .filter((recipe) => recipe.is_active && recipe.target_type === "MODIFIER_OPTION" && recipe.modifier_option_id)
      .map((recipe) => recipe.modifier_option_id),
  );
  return {
    items: items.filter((item) => !trackedItems.has(item.id)),
    options: options.filter((option) => !trackedOptions.has(option.id)),
  };
}
