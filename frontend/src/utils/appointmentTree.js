// Convert the database-owned appointment tree into the shape the booking UI uses.
export function normalizeAppointmentTree(tree) {
  return (Array.isArray(tree) ? tree : []).map((category) => ({
    id: category._id,
    icon: category.icon || "stethoscope",
    label: category.name || "Untitled Category",
    description: category.description || "",
    price: Number.isFinite(Number(category.price)) ? Number(category.price) : 0,
    currency: category.currency || "USD",
    specialties: (Array.isArray(category.specialties)
      ? category.specialties
      : []
    ).map((specialty) => ({
      id: specialty._id,
      name: specialty.name || "Untitled Specialty",
      icon: specialty.icon || "stethoscope",
      conditions: (Array.isArray(specialty.conditions)
        ? specialty.conditions
        : []
      ).map((condition) => [
        condition.name || "Untitled Condition",
        condition.icon || "stethoscope",
        condition._id,
        condition.description || "",
      ]),
    })),
  }));
}
