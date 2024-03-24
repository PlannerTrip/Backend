const mongoose = require("mongoose");
const { Schema } = mongoose;

const ReportSchema = new Schema({
  reportId: String,
  createBy: String,
  detail: { type: String, default: "" },
  createDate: { type: Date, default: Date.now() },
});

module.exports = mongoose.model("Report", ReportSchema);
