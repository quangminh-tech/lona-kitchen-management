import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  createContext,
} from "react";
import { analyse, clone, validate, uuid, servings } from "../engine.js";
import {
  load,
  save,
  reset,
  download,
  csv,
  parseCSV,
  apiEnabled,
  loadServer,
} from "../data.js";
import { f, money, scopes, units, days, dayLabel } from "../services/format.js";
import { Button, Table, Title, Icon } from "../components/Primitives.jsx";
export function confirmDelete({ s, commit, modal, collection, row }) {
  const used =
    collection === "dishes"
      ? s.menus.some((m) => m.dishId === row.id) ||
        s.recipes.some((r) =>
          r.lines.some(
            (l) => l.kind === "recipe" && l.recipeId === row.recipeId,
          ),
        ) ||
        s.ledger.length > 0
      : s.recipes.some((r) => r.lines.some((l) => l.itemId === row.id)) ||
        s.orders.some((o) => o.itemId === row.id) ||
        s.ledger.some((l) => l.itemId === row.id) ||
        row.stock > 0 ||
        row.reserved > 0;
  modal({
    title: used
      ? "Không thể xóa dữ liệu đang sử dụng"
      : "Xóa " + row.name + "?",
    body: (
      <>
        <p>
          {used
            ? "Mặt hàng / món này đang có liên kết, tồn kho hoặc lịch sử giao dịch. Hãy xử lý các liên kết trước khi xóa."
            : "Dữ liệu chưa sử dụng sẽ được xóa khỏi danh mục."}
        </p>
        <div className="actions">
          <Button onClick={() => modal(null)}>Đóng</Button>
          {!used && (
            <Button
              icon="trash"
              onClick={async () => {
                if (await commit("delete", { collection, id: row.id }))
                  modal(null);
              }}
            >
              Xác nhận xóa
            </Button>
          )}
        </div>
      </>
    ),
  });
}
