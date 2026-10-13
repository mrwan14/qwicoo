/**
 * Inventory API codes. Spread into the shared catalog so asApiError can translate them.
 */

type InventoryErrorCopy = {
  en: string;
  ar: string;
  aliases?: readonly string[];
};

export const inventoryErrorCatalog: Record<string, InventoryErrorCopy> = {
  INGREDIENT_NOT_FOUND: {
    en: "That ingredient is no longer on the catalogue.",
    ar: "هذا المكوّن لم يعد في الدليل.",
  },
  UNIT_NOT_FOUND: {
    en: "That unit is not on this brand.",
    ar: "وحدة القياس هذه غير موجودة لهذه العلامة.",
  },
  WAREHOUSE_NOT_FOUND: {
    en: "That store could not be found.",
    ar: "تعذر العثور على هذا المخزن.",
  },
  ALREADY_OPENED: {
    en: "This ingredient already has an opening balance here.",
    ar: "لهذا المكوّن رصيد افتتاحي في هذا المخزن.",
  },
  SKU_TAKEN: {
    en: "That SKU is already used. Choose another.",
    ar: "رمز الصنف مستخدم. اختر رمزاً آخر.",
  },
  UNIT_CODE_TAKEN: {
    en: "That unit code is already used.",
    ar: "رمز الوحدة مستخدم مسبقاً.",
  },
  CONVERSION_EXISTS: {
    en: "That conversion is already saved.",
    ar: "هذا التحويل محفوظ مسبقاً.",
  },
  WAREHOUSE_CODE_TAKEN: {
    en: "That kitchen code is already used.",
    ar: "رمز المطبخ مستخدم مسبقاً.",
  },
  DUPLICATE_MOVEMENT: {
    en: "That stock movement was already posted.",
    ar: "حركة المخزون هذه سُجّلت مسبقاً.",
  },
  INSUFFICIENT_STOCK: {
    en: "There isn't enough on hand for that quantity.",
    ar: "الكمية المتوفرة لا تكفي.",
  },
  RECEIVE_EXCEEDS_ORDERED: {
    en: "That receipt is more than the order still allows.",
    ar: "كمية الاستلام أكبر مما تبقى في أمر الشراء.",
  },
  RECEIVE_EXCEEDS_SENT: {
    en: "That receipt is more than was sent.",
    ar: "كمية الاستلام أكبر مما تم إرساله.",
  },
  PO_NOT_RECEIVABLE: {
    en: "This purchase order can't be received in its current state.",
    ar: "لا يمكن استلام أمر الشراء في حالته الحالية.",
  },
  PO_NOT_DRAFT: {
    en: "Only a draft purchase order can be sent.",
    ar: "يمكن إرسال أمر الشراء وهو مسودة فقط.",
  },
  PO_HAS_RECEIPTS: {
    en: "This order already has a receipt. Close the rest instead of cancelling it.",
    ar: "هذا الأمر فيه استلام بالفعل. أغلق المتبقي بدل إلغائه.",
  },
  PO_NOT_CANCELLABLE: {
    en: "This purchase order can no longer be cancelled.",
    ar: "لم يعد يمكن إلغاء أمر الشراء هذا.",
  },
  WAREHOUSE_OR_BRANCH_REQUIRED: {
    en: "Choose a branch or a store.",
    ar: "اختر فرعاً أو مخزناً.",
  },
  WAREHOUSE_OR_BRAND_REQUIRED: {
    en: "Choose a store, or look across the brand.",
    ar: "اختر مخزناً، أو اعرض العلامة كلها.",
  },
  TRANSFER_NOT_APPROVED: {
    en: "Approve the transfer before sending it.",
    ar: "وافق على التحويل قبل إرساله.",
  },
  TRANSFER_NOT_SENT: {
    en: "This transfer has not been sent yet.",
    ar: "لم يُرسل هذا التحويل بعد.",
  },
  TRANSFER_NOT_REQUESTED: {
    en: "Only a requested transfer can be approved.",
    ar: "يمكن الموافقة على التحويل وهو قيد الطلب فقط.",
  },
  COUNT_NOT_OPEN: {
    en: "This count is no longer open.",
    ar: "هذا الجرد لم يعد مفتوحاً.",
  },
  COUNT_NOT_SUBMITTED: {
    en: "Submit the count before posting it.",
    ar: "أرسل الجرد قبل ترحيله.",
  },
  COUNT_KIND: {
    en: "Choose a full count or a partial count.",
    ar: "اختر جرداً كاملاً أو جزئياً.",
  },
  COUNT_INGREDIENTS_REQUIRED: {
    en: "A partial count needs at least one ingredient.",
    ar: "الجرد الجزئي يحتاج مكوّناً واحداً على الأقل.",
  },
  COUNT_LINE_NOT_FOUND: {
    en: "That ingredient is not on this count sheet.",
    ar: "هذا المكوّن ليس في ورقة الجرد.",
  },
  COUNT_INCOMPLETE: {
    en: "Enter a count for every line before posting.",
    ar: "أدخل الكمية لكل بند قبل الترحيل.",
  },
  INVALID_DIMENSION: {
    en: "That unit doesn't match the ingredient's measure.",
    ar: "وحدة القياس لا تطابق نوع المكوّن.",
  },
  CONVERSION_SAME_UNIT: {
    en: "Choose two different units.",
    ar: "اختر وحدتين مختلفتين.",
  },
  INVALID_FACTOR: {
    en: "The conversion factor must be greater than zero.",
    ar: "معامل التحويل يجب أن يكون أكبر من صفر.",
  },
  DIMENSION_MISMATCH: {
    en: "Those units are not in the same measure.",
    ar: "الوحدتان ليستا من نفس النوع.",
  },
  CSV_HEADER_MISSING: {
    en: "The file needs columns sku, name_en, name_ar, and base_unit.",
    ar: "الملف يحتاج الأعمدة sku و name_en و name_ar و base_unit.",
  },
  CSV_TOO_LARGE: {
    en: "That file has more than 1,000 rows.",
    ar: "الملف يحتوي على أكثر من 1000 صف.",
  },
  WAREHOUSE_REQUIRED: {
    en: "Choose a store before importing opening balances.",
    ar: "اختر مخزناً قبل استيراد الأرصدة الافتتاحية.",
  },
  INVALID_QUANTITY: {
    en: "Enter a valid quantity.",
    ar: "أدخل كمية صحيحة.",
  },
  INVALID_COST: {
    en: "Enter a valid cost.",
    ar: "أدخل تكلفة صحيحة.",
  },
  DUPLICATE_SKU_IN_FILE: {
    en: "The file repeats a SKU. Keep one row for each.",
    ar: "الملف يكرر رمز صنف. أبقِ صفاً واحداً لكل رمز.",
  },
  NAME_REQUIRED: {
    en: "Each ingredient needs an English name and an Arabic name.",
    ar: "كل مكوّن يحتاج اسماً بالإنجليزية واسماً بالعربية.",
  },
  UNIT_COST_REQUIRED: {
    en: "Enter a unit cost above zero.",
    ar: "أدخل تكلفة وحدة أكبر من صفر.",
  },
  INVALID_UNIT_CODE: {
    en: "Use a short unit code with letters or numbers.",
    ar: "استخدم رمز وحدة قصيراً من حروف أو أرقام.",
  },
  INVALID_SKU: {
    en: "Use a short SKU with letters or numbers.",
    ar: "استخدم رمز صنف قصيراً من حروف أو أرقام.",
  },
  ZERO_QUANTITY: {
    en: "The quantity can't be zero.",
    ar: "الكمية لا يمكن أن تكون صفراً.",
  },
  QUANTITY_SIGN: {
    en: "That quantity has the wrong sign for this movement.",
    ar: "إشارة الكمية لا تناسب هذه الحركة.",
  },
  INGREDIENT_WAREHOUSE_MISMATCH: {
    en: "That ingredient doesn't belong to this brand's store.",
    ar: "هذا المكوّن لا يتبع مخزن هذه العلامة.",
  },
  BALANCE_MISSING: {
    en: "This ingredient has no balance in that store yet.",
    ar: "لا يوجد رصيد لهذا المكوّن في هذا المخزن بعد.",
  },
  REASON_REQUIRED: {
    en: "Add a reason for this adjustment.",
    ar: "أضف سبب هذا التعديل.",
  },
  PO_LINE_NOT_FOUND: {
    en: "That purchase line is not on the order.",
    ar: "بند الشراء هذا ليس في الأمر.",
  },
  WASTE_REASON: {
    en: "Choose a waste reason.",
    ar: "اختر سبب الهدر.",
  },
  NOTE_REQUIRED: {
    en: "Add a note when the reason is Other.",
    ar: "أضف ملاحظة عندما يكون السبب «أخرى».",
  },
  TRANSFER_LINE_NOT_FOUND: {
    en: "That line is not on the transfer.",
    ar: "هذا البند ليس في التحويل.",
  },
  PREP_NOT_FOUND: {
    en: "Choose a prep ingredient.",
    ar: "اختر مكوّن تحضير.",
  },
  RECIPE_NOT_FOUND: {
    en: "That prep item has no recipe yet.",
    ar: "مكوّن التحضير هذا بلا وصفة بعد.",
  },
  UNIT_CONVERSION_NOT_FOUND: {
    en: "There is no conversion between those units.",
    ar: "لا يوجد تحويل بين هاتين الوحدتين.",
  },
  INVALID_YIELD: {
    en: "Yield must be greater than zero.",
    ar: "الإنتاج يجب أن يكون أكبر من صفر.",
  },
  RECIPE_EXISTS: {
    en: "That item already has a recipe.",
    ar: "لهذا الصنف وصفة بالفعل.",
  },
  RECIPE_LINES_REQUIRED: {
    en: "Add at least one recipe line.",
    ar: "أضف بنداً واحداً على الأقل في الوصفة.",
  },
  RECIPE_CYCLE: {
    en: "That recipe loops back on itself.",
    ar: "هذه الوصفة تعود إلى نفسها.",
  },
  INVALID_WASTE: {
    en: "Waste percent must be between 0 and 100.",
    ar: "نسبة الهدر يجب أن تكون بين 0 و 100.",
  },
  RECIPE_TARGET: {
    en: "Choose a menu item, a modifier, or a prep ingredient.",
    ar: "اختر صنفاً من القائمة أو إضافة أو مكوّن تحضير.",
  },
  REPLACEMENT_ONLY_ON_MODIFIER: {
    en: "Only a modifier option can replace a base ingredient.",
    ar: "استبدال مكوّن أساسي يكون لخيار إضافة فقط.",
  },
  MENU_ITEM_NOT_FOUND: {
    en: "That menu item is not on this brand.",
    ar: "صنف القائمة هذا ليس في هذه العلامة.",
  },
  MODIFIER_NOT_FOUND: {
    en: "That modifier option is not on this brand.",
    ar: "خيار الإضافة هذا ليس في هذه العلامة.",
  },
  RECIPE_TOO_DEEP: {
    en: "Recipes can nest only three levels deep.",
    ar: "الوصفات تتداخل حتى ثلاثة مستويات فقط.",
  },
  SALE_NOT_POSTED: {
    en: "That sale was never deducted, so it can't be reversed.",
    ar: "هذا البيع لم يُخصم، فلا يمكن عكسه.",
  },
  CONFLICTING_BRAND_ID: {
    en: "The brand on this request doesn't match the one you're working in.",
    ar: "العلامة في هذا الطلب لا تطابق العلامة التي تعمل عليها.",
  },
  CENTRAL_KITCHEN_PO_UNSUPPORTED: {
    en: "Purchase orders are for a branch store, not a central kitchen.",
    ar: "أوامر الشراء لمخزن الفرع، وليس للمطبخ المركزي.",
  },
  INVALID_RANGE: {
    en: "The end of the range must be after the start.",
    ar: "نهاية الفترة يجب أن تكون بعد بدايتها.",
  },
  WAREHOUSE_FORBIDDEN: {
    en: "You can't change stock in that store.",
    ar: "لا يمكنك تعديل المخزون في هذا المخزن.",
    aliases: ["Access to warehouse is forbidden"],
  },
  BRAND_FORBIDDEN: {
    en: "You can't open that brand's inventory.",
    ar: "لا يمكنك فتح مخزون هذه العلامة.",
    aliases: ["Access to brand is forbidden"],
  },
};
