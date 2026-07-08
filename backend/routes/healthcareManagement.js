const express = require("express");
const router = express.Router();
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listSpecialties,
  createSpecialty,
  updateSpecialty,
  deleteSpecialty,
  listConditions,
  createCondition,
  updateCondition,
  deleteCondition,
} = require("../controllers/healthcareManagementController");

router.use(verifyAdminToken, superAdminOnly);

router.get("/categories", listCategories);
router.post("/categories", createCategory);
router.put("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

router.get("/specialties", listSpecialties);
router.post("/specialties", createSpecialty);
router.put("/specialties/:id", updateSpecialty);
router.delete("/specialties/:id", deleteSpecialty);

router.get("/conditions", listConditions);
router.post("/conditions", createCondition);
router.put("/conditions/:id", updateCondition);
router.delete("/conditions/:id", deleteCondition);

module.exports = router;
