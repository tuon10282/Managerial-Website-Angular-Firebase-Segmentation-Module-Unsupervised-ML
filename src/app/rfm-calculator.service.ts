import { Injectable, inject } from '@angular/core';
import { 
  Firestore,
  collection, 
  query, 
  getDocs
} from '@angular/fire/firestore';
import { Order } from '../classes/Order';
import { Customer } from '../classes/Customer';
import { RFMMetrics } from '../classes/RFM';

@Injectable({
  providedIn: 'root'
})
export class RFMCalculatorService {
  private firestore = inject(Firestore);
  
  private readonly COLLECTIONS = {
    ORDERS: 'orders',
    CUSTOMERS: 'users'
  };

  // Tính toán RFM metrics cho tất cả customers
  async calculateRFMMetrics(): Promise<RFMMetrics[]> {
    try {
      const customers = await this.getAllCustomers();
      const orders = await this.getAllOrders();
      const currentDate = new Date();

      // ===== DEBUG LOGS =====
      console.log('🔍 DEBUGGING RFM CALCULATION');
      console.log('📊 Total customers:', customers.length);
      console.log('📦 Total orders:', orders.length);
      
      // Check order statuses
      const statusCount = orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log('📋 Orders by status:', statusCount);

      // Check delivered orders
      const deliveredOrders = orders.filter(o => o.status === 'delivered');
      console.log('✅ Delivered orders:', deliveredOrders.length);

      // Check unique user_ids in orders vs customers
      const customerIds = new Set(customers.map(c => c.id)); // Dùng document ID
      const orderUserIds = new Set(orders.map(o => o.user_id));
      console.log('👥 Unique customer IDs (doc IDs):', customerIds.size);
      console.log('🛒 Unique user IDs in orders:', orderUserIds.size);
      
      // Check intersection - customer.id vs order.user_id
      const customerIdsStr = new Set(customers.map(c => c.id.toString()));
      const orderUserIdsStr = new Set(orders.filter(o => o.user_id).map(o => o.user_id.toString()));
      const intersection = new Set([...customerIdsStr].filter(id => orderUserIdsStr.has(id)));
      console.log('🤝 Customers who have orders (doc.id vs user_id):', intersection.size);

      // Sample data check
      console.log('📝 Sample customer:', customers[0]);
      console.log('📝 Sample order:', orders[0]);
      
      // Check data types
      if (customers[0] && orders[0]) {
        console.log('🔤 Customer user_id type:', typeof customers[0].user_id);
        console.log('🔤 Order user_id type:', typeof orders[0].user_id);
      }
      // ===== END DEBUG =====

      const rfmMetrics: RFMMetrics[] = [];
      let processedCount = 0;

      for (const customer of customers) {
        // Skip customers without id
        if (!customer.id) {
          console.log(`⚠️ Skipping customer with undefined id`);
          continue;
        }

        // Match customer.id với order.user_id
        const customerId = customer.id.toString();
        
        const customerOrders = orders.filter(
          order => order.user_id && order.user_id.toString() === customerId && 
          order.status === 'delivered'
        );

        console.log(`👤 Customer ${customer.id}: ${customerOrders.length} delivered orders`);

        if (customerOrders.length === 0) {
          console.log(`⏭️ Skipping customer ${customer.user_id} - no delivered orders`);
          continue;
        }

        processedCount++;
        console.log(`✅ Processing customer ${customer.id} (${processedCount})`);

        // Recency: Số ngày từ lần mua cuối đến hiện tại
        const lastOrderDate = new Date(
          Math.max(...customerOrders.map(order => new Date(order.created_at).getTime()))
        );
        const recency = Math.floor(
          (currentDate.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Frequency: Số lần mua
        const frequency = customerOrders.length;

        // Monetary: Tổng giá trị mua
        const monetary = customerOrders.reduce((sum, order) => sum + order.total, 0);

        console.log(`📈 Customer ${customer.id} metrics: R=${recency}, F=${frequency}, M=${monetary}`);

        // Tính RFM Score (1-5 scale) ngay tại đây
        const rfmScore = this.calculateIndividualRFMScore(
          { recency, frequency, monetary }, 
          { customers, orders }
        );

        rfmMetrics.push({
          user_id: customer.id, // Dùng document ID
          recency,
          frequency,
          monetary,
          rfm_score: rfmScore
        });

        console.log(`🎯 Customer ${customer.id} RFM Score: ${rfmScore}`);
      }

      console.log(`🎯 Total customers processed: ${processedCount}`);
      console.log(`📊 RFM Metrics calculated for ${rfmMetrics.length} customers`);
      
      return rfmMetrics;
    } catch (error) {
      console.error('💥 Error calculating RFM metrics:', error);
      throw error;
    }
  }

  // Tính RFM Score cho 1 customer dựa trên toàn bộ dataset
  private calculateIndividualRFMScore(
    currentMetric: { recency: number, frequency: number, monetary: number },
    allData: { customers: Customer[], orders: Order[] }
  ): string {
    // Tính toàn bộ metrics để có thể so sánh
    const allMetrics = this.calculateAllMetricsForScoring(allData);
    
    console.log(`🔢 Total metrics for scoring: ${allMetrics.length}`);
    
    // Sắp xếp để tính quintiles
    const sortedByRecency = [...allMetrics].sort((a, b) => a.recency - b.recency);
    const sortedByFrequency = [...allMetrics].sort((a, b) => b.frequency - a.frequency);
    const sortedByMonetary = [...allMetrics].sort((a, b) => b.monetary - a.monetary);

    const quintileSize = Math.ceil(allMetrics.length / 5);
    console.log(`📏 Quintile size: ${quintileSize}`);

    // FIX: Tìm vị trí của customer hiện tại - chỉ so sánh metric tương ứng
    const rIndex = sortedByRecency.findIndex(m => m.recency === currentMetric.recency);
    const fIndex = sortedByFrequency.findIndex(m => m.frequency === currentMetric.frequency);
    const mIndex = sortedByMonetary.findIndex(m => m.monetary === currentMetric.monetary);

    console.log(`📍 Indexes: R=${rIndex}, F=${fIndex}, M=${mIndex}`);

    const rScore = rIndex === -1 ? 1 : Math.min(5, Math.floor(rIndex / quintileSize) + 1);
    const fScore = fIndex === -1 ? 1 : Math.min(5, Math.floor(fIndex / quintileSize) + 1);
    const mScore = mIndex === -1 ? 1 : Math.min(5, Math.floor(mIndex / quintileSize) + 1);

    console.log(`🎯 Scores: R=${rScore}, F=${fScore}, M=${mScore}`);

    return `${rScore}${fScore}${mScore}`;
  }

  // Helper method để tính toàn bộ metrics (dùng cho scoring)
  private calculateAllMetricsForScoring(allData: { customers: Customer[], orders: Order[] }): Array<{recency: number, frequency: number, monetary: number}> {
    const currentDate = new Date();
    const metrics: Array<{recency: number, frequency: number, monetary: number}> = [];

    for (const customer of allData.customers) {
      if (!customer.id) continue;
      
      const customerId = customer.id.toString();
      const customerOrders = allData.orders.filter(
        order => order.user_id && order.user_id.toString() === customerId && order.status === 'delivered'
      );

      if (customerOrders.length === 0) continue;

      const lastOrderDate = new Date(
        Math.max(...customerOrders.map(order => new Date(order.created_at).getTime()))
      );
      const recency = Math.floor(
        (currentDate.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const frequency = customerOrders.length;
      const monetary = customerOrders.reduce((sum, order) => sum + order.total, 0);

      metrics.push({ recency, frequency, monetary });
    }

    return metrics;
  }

  // Helper methods
  private async getAllCustomers(): Promise<Customer[]> {
    const q = query(collection(this.firestore, this.COLLECTIONS.CUSTOMERS));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Customer));
  }

  private async getAllOrders(): Promise<Order[]> {
    const q = query(collection(this.firestore, this.COLLECTIONS.ORDERS));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Order));
  }
}