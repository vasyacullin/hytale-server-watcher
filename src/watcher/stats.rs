use crate::watcher::state::{AppState, ResourceStats};
use std::sync::Arc;
use sysinfo::{Networks, Pid, System};
use tokio::sync::watch;
use tokio::time::{interval, Duration};

pub struct StatsCollector {
    state: Arc<AppState>,
    shutdown_rx: watch::Receiver<bool>,
}

impl StatsCollector {
    pub fn new(state: Arc<AppState>, shutdown_rx: watch::Receiver<bool>) -> Self {
        Self { state, shutdown_rx }
    }

    pub async fn run(mut self) {
        let mut system = System::new_all();
        let mut networks = Networks::new_with_refreshed_list();
        let mut last_rx: u64 = 0;
        let mut last_tx: u64 = 0;
        let mut last_disk_read: u64 = 0;
        let mut last_disk_write: u64 = 0;

        let mut ticker = interval(Duration::from_secs(1));

        loop {
            tokio::select! {
                _ = ticker.tick() => {}
                _ = self.shutdown_rx.changed() => {
                    if *self.shutdown_rx.borrow() {
                        break;
                    }
                }
            }

            let pid = self.state.pid();

            system.refresh_all();
            networks.refresh();

            let (cpu, mem_mb, mem_percent) = if let Some(p) = pid {
                if let Some(process) = system.process(Pid::from_u32(p)) {
                    let cpu = process.cpu_usage();
                    let mem = process.memory() / 1024 / 1024;
                    let total_mem = system.total_memory() / 1024 / 1024;
                    let mem_pct = (mem as f32 / total_mem as f32) * 100.0;
                    (cpu, mem, mem_pct)
                } else {
                    (0.0, 0, 0.0)
                }
            } else {
                (0.0, 0, 0.0)
            };

            // Network stats
            let mut total_rx: u64 = 0;
            let mut total_tx: u64 = 0;
            for (_name, data) in networks.iter() {
                total_rx += data.total_received();
                total_tx += data.total_transmitted();
            }

            let rx_speed = total_rx.saturating_sub(last_rx);
            let tx_speed = total_tx.saturating_sub(last_tx);
            last_rx = total_rx;
            last_tx = total_tx;

            // Disk I/O stats
            let (disk_read_speed, disk_write_speed) = if let Some(p) = pid {
                if let Some(process) = system.process(Pid::from_u32(p)) {
                    let disk_usage = process.disk_usage();
                    let read_speed = disk_usage.read_bytes.saturating_sub(last_disk_read);
                    let write_speed = disk_usage.written_bytes.saturating_sub(last_disk_write);
                    last_disk_read = disk_usage.read_bytes;
                    last_disk_write = disk_usage.written_bytes;
                    (read_speed, write_speed)
                } else {
                    (0, 0)
                }
            } else {
                (0, 0)
            };

            self.state.set_stats(ResourceStats {
                cpu_percent: cpu,
                memory_mb: mem_mb,
                memory_percent: mem_percent,
                network_rx_speed: rx_speed,
                network_tx_speed: tx_speed,
                disk_read_speed,
                disk_write_speed,
            });
        }

        tracing::info!("Stats collector stopped");
    }
}
