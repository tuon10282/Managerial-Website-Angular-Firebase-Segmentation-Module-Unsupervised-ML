import { Injectable } from '@angular/core';
import { RFMMetrics } from '../classes/RFM';

// Define the enhanced type for clustered metrics
type ClusteredRFMMetrics = RFMMetrics & { cluster_id: number; segment: string };

@Injectable({
  providedIn: 'root'
})
/**
 * Dịch vụ KMeansService để thực hiện phân cụm K-means trên dữ liệu RFM.
 * Dịch vụ này sẽ nhận vào một mảng các đối tượng RFMMetrics và trả về kết quả phân cụm.
 */
export class KMeansService {
  // Chạy K-means clustering với 4 clusters
  async performKMeansClustering(metrics: RFMMetrics[], k: number = 4): Promise<{ clusteredMetrics: ClusteredRFMMetrics[], centers: any[] }> {
    if (metrics.length === 0) {
      return { clusteredMetrics: [], centers: [] };
    }

    // Chuẩn hóa dữ liệu
    const normalizedData = this.normalizeData(metrics);
    
    // Khởi tạo centroids ngẫu nhiên
    let centroids = this.initializeCentroids(normalizedData, k);
    let previousCentroids: number[][] = [];
    let iterations = 0;
    const maxIterations = 100;

    while (!this.centroidsConverged(centroids, previousCentroids) && iterations < maxIterations) {
      previousCentroids = centroids.map(c => [...c]);
      
      // Gán clusters
      const clusters = this.assignClusters(normalizedData, centroids);
      
      // Cập nhật centroids
      centroids = this.updateCentroids(normalizedData, clusters, k);
      iterations++;
    }

    // Gán cluster cho mỗi customer
    const finalClusters = this.assignClusters(normalizedData, centroids);
    
    // Tạo labels cho từng cluster dựa trên dữ liệu thực
    const clusterLabels = this.generateClusterLabels(metrics, finalClusters);

    // Gán cluster_id và segment cho metrics với proper typing
    const clusteredMetrics: ClusteredRFMMetrics[] = metrics.map((metric, index) => ({
      ...metric,
      cluster_id: finalClusters[index],
      segment: clusterLabels[finalClusters[index]]
    }));

    const centers = centroids.map((center, index) => ({
      cluster_id: index,
      recency_center: center[0],
      frequency_center: center[1],
      monetary_center: center[2],
      segment_label: clusterLabels[index]
    }));

    return { clusteredMetrics, centers };
  }

  private normalizeData(metrics: RFMMetrics[]): number[][] {
    const recencyValues = metrics.map(m => m.recency);
    const frequencyValues = metrics.map(m => m.frequency);
    const monetaryValues = metrics.map(m => m.monetary);

    const recencyMin = Math.min(...recencyValues);
    const recencyMax = Math.max(...recencyValues);
    const frequencyMin = Math.min(...frequencyValues);
    const frequencyMax = Math.max(...frequencyValues);
    const monetaryMin = Math.min(...monetaryValues);
    const monetaryMax = Math.max(...monetaryValues);

    return metrics.map(metric => [
      this.normalize(metric.recency, recencyMin, recencyMax),
      this.normalize(metric.frequency, frequencyMin, frequencyMax),
      this.normalize(metric.monetary, monetaryMin, monetaryMax)
    ]);
  }

  private normalize(value: number, min: number, max: number): number {
    return max === min ? 0 : (value - min) / (max - min);
  }

  private initializeCentroids(data: number[][], k: number): number[][] {
    const centroids: number[][] = [];
    for (let i = 0; i < k; i++) {
      const randomIndex = Math.floor(Math.random() * data.length);
      centroids.push([...data[randomIndex]]);
    }
    return centroids;
  }

  private assignClusters(data: number[][], centroids: number[][]): number[] {
    return data.map(point => {
      let minDistance = Infinity;
      let closestCentroid = 0;

      centroids.forEach((centroid, index) => {
        const distance = this.euclideanDistance(point, centroid);
        if (distance < minDistance) {
          minDistance = distance;
          closestCentroid = index;
        }
      });

      return closestCentroid;
    });
  }

  private euclideanDistance(point1: number[], point2: number[]): number {
    return Math.sqrt(
      point1.reduce((sum, val, index) => sum + Math.pow(val - point2[index], 2), 0)
    );
  }

  private updateCentroids(data: number[][], clusters: number[], k: number): number[][] {
    const newCentroids: number[][] = [];

    for (let i = 0; i < k; i++) {
      const clusterPoints = data.filter((_, index) => clusters[index] === i);
      
      if (clusterPoints.length === 0) {
        newCentroids.push([Math.random(), Math.random(), Math.random()]);
        continue;
      }

      const centroid = clusterPoints[0].map((_, dimIndex) =>
        clusterPoints.reduce((sum, point) => sum + point[dimIndex], 0) / clusterPoints.length
      );

      newCentroids.push(centroid);
    }

    return newCentroids;
  }

  private centroidsConverged(current: number[][], previous: number[][]): boolean {
    if (previous.length === 0) return false;
    
    const threshold = 0.001;
    return current.every((centroid, index) =>
      centroid.every((val, dimIndex) =>
        Math.abs(val - previous[index][dimIndex]) < threshold
      )
    );
  }

  private generateClusterLabels(metrics: RFMMetrics[], clusters: number[]): string[] {
    const labels: string[] = new Array(4).fill('');
    
    // Tính trung bình cho từng cluster
    for (let i = 0; i < 4; i++) {
      const clusterMetrics = metrics.filter((_, index) => clusters[index] === i);
      
      if (clusterMetrics.length === 0) {
        labels[i] = 'Cần chăm sóc';
        continue;
      }

      const avgRecency = clusterMetrics.reduce((sum, m) => sum + m.recency, 0) / clusterMetrics.length;
      const avgFrequency = clusterMetrics.reduce((sum, m) => sum + m.frequency, 0) / clusterMetrics.length;
      const avgMonetary = clusterMetrics.reduce((sum, m) => sum + m.monetary, 0) / clusterMetrics.length;

      // Logic phân loại dựa trên trung bình của cluster
      if (avgRecency <= 30 && avgFrequency >= 4 && avgMonetary >= 2000000) {
        labels[i] = 'VIP';
      } else if (avgFrequency >= 3 && avgMonetary >= 1000000) {
        labels[i] = 'Loyal';
      } else if (avgRecency <= 60 || avgFrequency >= 2) {
        labels[i] = 'Potential';
      } else {
        labels[i] = 'Pay attetion';
      }
    }

    return labels;
  }
}