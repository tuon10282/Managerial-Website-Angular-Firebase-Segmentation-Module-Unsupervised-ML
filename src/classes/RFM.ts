export interface RFMMetrics {
  user_id: string;
  recency: number; // số ngày từ lần mua cuối
  frequency: number; // số lần mua
  monetary: number; // tổng giá trị mua
  rfm_score: string; // ví dụ: "543"
}

export interface RFMSegmentation {
  id?: string;
  user_id: string;
  recency: number;
  frequency: number;
  monetary: number;
  rfm_score: string;
  segment: string; // VIP, Trung thành, Tiềm năng, Cần chăm sóc
  cluster_id: number;
  created_at: string;
  updated_at: string;
}

export interface ClusterCenter {
  cluster_id: number;
  recency_center: number;
  frequency_center: number;
  monetary_center: number;
  segment_label: string;
}
